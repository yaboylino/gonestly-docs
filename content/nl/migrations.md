---
title: Migraties
description: Wijzig het schema met genummerde SQL-bestanden die bij het starten worden uitgevoerd, elk in een eigen transactie.
---

Migraties zijn gewone SQL-bestanden die het schema stap voor stap wijzigen. Je kunt ze met de hand schrijven, zoals deze pagina laat zien, of Gonestly ze uit je modellen laten schrijven: zie [schema vanuit je modellen](schema). Gonestly voert de openstaande migraties uit als de applicatie start, op volgorde, elk in een eigen transactie, en legt ze vast in de tabel `gonestly_migrations`.

## Migraties schrijven

Elke migratie is een paar bestanden met een versie en een naam in kleine letters:

```text
migrations/
  0001_create_users.up.sql
  0001_create_users.down.sql
  0002_add_user_email.up.sql
  0002_add_user_email.down.sql
  migrations.go
```

```sql title="migrations/0001_create_users.up.sql"
CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql title="migrations/0001_create_users.down.sql"
DROP TABLE users;
```

Een bestand kan meerdere statements bevatten, ook triggers en routines met eigen puntkomma's in hun body; MySQL heeft daar geen `DELIMITER`-regel voor nodig.

Het `.down.sql`-bestand draait de migratie terug en is optioneel. Versies zijn getallen: een teller als `0001` of een tijdstempel als `20261125143000` werkt allebei, zolang elke versie uniek is.

Bed de bestanden in je binary in, zodat ze meegaan:

```go title="migrations/migrations.go"
package migrations

import "embed"

//go:embed *.sql
var Files embed.FS
```

### Buiten een transactie

Sommige statements kunnen niet in een transactie draaien, zoals `CREATE INDEX CONCURRENTLY` in PostgreSQL, dat een index bouwt zonder schrijfacties te blokkeren. Begin het bestand met dit commentaar om het erbuiten te draaien:

```sql title="migrations/0007_index_orders.up.sql"
-- gonestly:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_customer ON orders (customer_id);
```

De statements draaien dan één voor één. Mislukt er een, dan blijven de eerdere staan en wordt de migratie niet vastgelegd. Houd zo'n bestand dus bij één statement, of schrijf het zo dat het opnieuw kan draaien, zoals met `IF NOT EXISTS` hierboven. Het commentaar geldt per bestand: zet het ook in het down-bestand als dat het nodig heeft.

### Met foreign keys uit

SQLite kan alleen een kolom toevoegen en weinig anders, dus een tabel wijzigen betekent hem opnieuw maken, en de oude droppen zou foreign keys rijen laten verwijderen in de tabellen die ernaar wijzen. Begin het bestand daarvoor met deze comment, en de migratie draait in een transactie met de foreign keys van SQLite uitgezet. Ze worden aan het eind gecontroleerd, en de migratie faalt als hij een rij achterliet die er een schendt. Andere databases negeren de comment, en `gonestly migrate dev` schrijft hem als dat nodig is.

```sql
-- gonestly:foreign-keys-off
CREATE TABLE orders__new (...);
INSERT INTO orders__new SELECT ... FROM orders;
DROP TABLE orders;
ALTER TABLE orders__new RENAME TO orders;
```

## Uitvoeren bij het starten

Geef de bestanden mee aan de [databasemodule](database), en openstaande migraties worden uitgevoerd voordat een provider de database gebruikt:

```go
sql.Module(sql.Options{Driver: "pgx", DSN: dsn, Migrations: migrations.Files})
```

Elke uitgevoerde migratie wordt gelogd. Faalt er een, dan wordt zijn transactie teruggedraaid, start de applicatie niet en noemt de fout de migratie.

> [!NOTE]
> MySQL en MariaDB leggen elke schemawijziging meteen vast, dus daar houdt een mislukte migratie de tabellen en kolommen die hij al heeft gemaakt. Houd zo'n migratie bij één schemawijziging, of schrijf hem zo dat hij opnieuw kan draaien.

## Veiligheidscontroles

Gonestly weigert te migreren als de bestanden en de database het oneens zijn:

| Situatie                                               | Melding                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Een uitgevoerde migratie is aangepast                  | `migration 1_create_users was changed after it was applied; add a new migration instead`          |
| Het bestand van een uitgevoerde migratie is weg        | `migration 1_create_users is applied but its file is missing`                                     |
| Een nieuwe migratie is ouder dan de laatst uitgevoerde | `migration 2_x is pending but the newer migration 3 is already applied; give it a higher version` |
| Een bestandsnaam volgt het patroon niet                | `create_users.up.sql does not follow <version>_<name>.up.sql or .down.sql`                        |

Van elk uitgevoerd bestand wordt een checksum bewaard, zodat een aanpassing wordt herkend, ook als de versie gelijk blijft. Twee instanties die tegelijk starten, migreren niet tegelijk: PostgreSQL, MySQL en MariaDB houden een lock vast, en op SQLite wacht elke migratie op de migratie die loopt.

## De migrator

Voor je eigen tooling geeft `sql.NewMigrator` directe controle:

```go
migrator, err := sql.NewMigrator(db, migrations.Files)
applied, err := migrator.Up(ctx)       // voer alle openstaande migraties uit
reverted, err := migrator.Down(ctx)    // draai de laatst uitgevoerde migratie terug
status, err := migrator.Status(ctx)    // elke migratie en of hij is uitgevoerd
```

De [CLI](cli#migraties) biedt hetzelfde via `gonestly migrate`, plus `gonestly migrate create <naam>` om een nieuwe migratie te beginnen.
