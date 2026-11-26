---
title: Database
description: Verbind met PostgreSQL, MySQL of SQLite via de sql-module, die de database aan elke module levert en hem bij het afsluiten sluit.
---

De module `sql` is de SQL-laag van Gonestly. Hij bouwt op `database/sql` uit de standaardbibliotheek en werkt met PostgreSQL, MySQL, MariaDB en SQLite. Hij staat in een eigen Go-module, zodat het framework vrij van dependencies blijft, en je kiest zelf de driver:

```sh
go get github.com/yaboylino/gonestly/sql
go get github.com/jackc/pgx/v5         # PostgreSQL
go get github.com/go-sql-driver/mysql  # MySQL en MariaDB
go get modernc.org/sqlite              # SQLite, zonder cgo
```

De SQL-laag werkt op drie niveaus, en je kunt ze vrij combineren:

| Niveau                                     | Gebruik het voor                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Repositories](repositories)               | Aanmaken, lezen, bijwerken en verwijderen op primaire sleutel, zonder SQL te schrijven. |
| [De querybuilder](queries#de-querybuilder) | Getypeerde queries met condities, sortering en paginering.                              |
| [Ruwe SQL](queries#ruwe-sql)               | Al het andere, direct ingelezen in structs.                                             |

## Verbinden

Met de CLI doet `gonestly add database` dit allemaal voor je; zie [een database toevoegen](cli#een-database-toevoegen). Om het zelf te doen, importeer je `sql.Module` in de rootmodule. Die verbindt als de applicatie start, controleert de verbinding, voert de [migraties](migrations) uit en levert een `*sql.DB` aan elke module:

```go title="main.go"
import (
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/yaboylino/gonestly/sql"
)

var AppModule = &gonestly.Module{
	Name: "app",
	Imports: gonestly.Imports(
		sql.Module(sql.Options{Driver: "pgx", DSN: "postgres://localhost/shop"}),
		users.Module,
	),
}
```

De lege import registreert de driver bij `database/sql`. Elke database heeft zijn eigen import en drivernaam:

| Database         | Import                               | `Driver` | Voorbeeld van een `DSN`                 |
| ---------------- | ------------------------------------ | -------- | --------------------------------------- |
| PostgreSQL       | `_ "github.com/jackc/pgx/v5/stdlib"` | `pgx`    | `postgres://user:secret@localhost/shop` |
| MySQL en MariaDB | `_ "github.com/go-sql-driver/mysql"` | `mysql`  | `user:secret@tcp(localhost:3306)/shop`  |
| SQLite           | `_ "modernc.org/sqlite"`             | `sqlite` | `file:shop.db`                          |

Als de applicatie stopt, wordt de connection pool gesloten nadat de HTTP-server zijn requests heeft afgerond.

Is de database niet bereikbaar, dan start de applicatie niet, en de fout noemt de oorzaak. Een driver die niet is geïmporteerd, wordt gemeld met de importregel die je moet toevoegen.

## Vanuit je configuratie

De connection string komt meestal uit de omgeving. `sql.ModuleFunc` bouwt de opties uit een provider van een globale module, zoals de [configuratie](configuration):

```go title="main.go"
type Config struct {
	DatabaseURL string `env:"DATABASE_URL,required"`
}

var AppModule = &gonestly.Module{
	Name: "app",
	Imports: gonestly.Imports(
		config.Module[Config](config.Options{}),
		sql.ModuleFunc(func(cfg Config) sql.Options {
			return sql.Options{Driver: "pgx", DSN: cfg.DatabaseURL, Migrations: migrations.Files}
		}),
		users.Module,
	),
}
```

## Opties

| Optie                                | Doel                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `Driver`                             | De naam van een geregistreerde `database/sql`-driver, zoals `pgx`, `mysql` of `sqlite`. |
| `DSN`                                | De connection string voor de driver.                                                    |
| `Dialect`                            | `sql.Postgres`, `sql.MySQL` of `sql.SQLite`; volgt uit de drivernamen hierboven.        |
| `MaxOpenConns`, `MaxIdleConns`       | De grootte van de connection pool.                                                      |
| `ConnMaxLifetime`, `ConnMaxIdleTime` | Hoe lang verbindingen worden hergebruikt.                                               |
| `Migrations`                         | Een `fs.FS` met [migraties](migrations) die bij het starten worden uitgevoerd.          |
| `Logger`                             | Krijgt elke query op debugniveau; standaard de logger van de applicatie.                |

## MySQL en MariaDB

Dezelfde code draait op elke database: schrijf `?` voor argumenten, en de repositories, de querybuilder, transacties en migraties gedragen zich hetzelfde. Een paar dingen zijn goed om te weten over MySQL en MariaDB:

- **De connection string is geen URL.** Hij heeft de vorm `user:password@tcp(host:3306)/database`.
- **Datums en tijden werken meteen.** Gonestly voegt `parseTime=true` toe aan de connection string als je die weglaat, zodat een `DATETIME`-kolom in een `time.Time` past.
- **Alleen een auto-increment-sleutel wordt voor je gegenereerd.** [Repositories](repositories) lezen die terug na een insert. Elke andere sleutel, zoals een UUID, zet je zelf voor `Create`.
- **Een schemawijziging wordt meteen vastgelegd.** Een [migratie](migrations) die halverwege faalt, houdt de tabellen die hij al heeft gemaakt.

## De database gebruiken

Elke provider kan de `*sql.DB` injecteren:

```go
func NewReportService(db *sql.DB) *ReportService {
	return &ReportService{db: db}
}
```

`db.Exec` voert een statement uit, `db.Transaction` start een [transactie](transactions) en `db.Std()` geeft de onderliggende `*sql.DB` van `database/sql`, voor bibliotheken die die nodig hebben.

## Modellen

Een model is een struct waarvan de velden bij kolommen horen. De kolomnaam is de `db`-tag, of de veldnaam in snake case, dus `CreatedAt` hoort bij `created_at`:

```go title="users/user.go"
type User struct {
	ID        int64     `db:"id"`
	Name      string    `db:"name"`
	Email     *string   `db:"email"`              // een pointer kan NULL bevatten
	CreatedAt time.Time `db:"created_at,default"` // ingevuld door de database
	Password  string    `db:"-"`                  // nooit gelezen of geschreven
}
```

| Tag             | Betekenis                                                                              |
| --------------- | -------------------------------------------------------------------------------------- |
| `db:"name"`     | De kolomnaam.                                                                          |
| `db:",pk"`      | De primaire sleutel. Zonder deze tag is het veld met de naam `ID` de primaire sleutel. |
| `db:",default"` | Bij een insert aan de database overgelaten als het leeg is, zoals een aanmaaktijd.     |
| `db:"-"`        | Geen kolom.                                                                            |

De tabelnaam is het meervoud van de typenaam in snake case, dus `OrderItem` gebruikt `order_items`. Voor andere namen voeg je een methode toe:

```go
func (Person) TableName() string { return "people" }
```

Velden van ingebedde structs worden kolommen van het model, handig voor gedeelde kolommen zoals tijdstempels. Kolommen die NULL kunnen zijn, gebruiken pointers of de `sql.Null`-types van `database/sql`, en elk type dat `sql.Scanner` en `driver.Valuer` implementeert werkt, zoals `uuid.UUID`.

Fouten in een model, zoals twee velden voor één kolom of een structveld dat geen kolom is, worden met de veldnaam gemeld zodra het model voor het eerst wordt gebruikt. [Repositories](repositories) controleren hun model al bij het starten van de applicatie.
