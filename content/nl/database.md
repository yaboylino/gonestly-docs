---
title: Database
description: Verbind met PostgreSQL of SQLite via de sql-module, die de database aan elke module levert en hem bij het afsluiten sluit.
---

De module `sql` is de SQL-laag van Gonestly. Hij bouwt op `database/sql` uit de standaardbibliotheek en werkt met PostgreSQL en SQLite. Hij staat in een eigen Go-module, zodat het framework vrij van dependencies blijft, en je kiest zelf de driver:

```sh
go get github.com/yaboylino/gonestly/sql
go get github.com/jackc/pgx/v5   # PostgreSQL
go get modernc.org/sqlite        # SQLite, zonder cgo
```

De SQL-laag werkt op drie niveaus, en je kunt ze vrij combineren:

| Niveau                                     | Gebruik het voor                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Repositories](repositories)               | Aanmaken, lezen, bijwerken en verwijderen op primaire sleutel, zonder SQL te schrijven. |
| [De querybuilder](queries#de-querybuilder) | Getypeerde queries met condities, sortering en paginering.                              |
| [Ruwe SQL](queries#ruwe-sql)               | Al het andere, direct ingelezen in structs.                                             |

## Verbinden

Importeer `sql.Module` in de rootmodule. Die verbindt als de applicatie start, controleert de verbinding, voert de [migraties](migrations) uit en levert een `*sql.DB` aan elke module:

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

De lege import registreert de driver bij `database/sql`; gebruik `_ "modernc.org/sqlite"` en de drivernaam `sqlite` voor SQLite. Als de applicatie stopt, wordt de connection pool gesloten nadat de HTTP-server zijn requests heeft afgerond.

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

| Optie                                | Doel                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `Driver`                             | De naam van een geregistreerde `database/sql`-driver, zoals `pgx` of `sqlite`. |
| `DSN`                                | De connection string voor de driver.                                           |
| `Dialect`                            | `sql.Postgres` of `sql.SQLite`; volgt uit de drivernamen hierboven.            |
| `MaxOpenConns`, `MaxIdleConns`       | De grootte van de connection pool.                                             |
| `ConnMaxLifetime`, `ConnMaxIdleTime` | Hoe lang verbindingen worden hergebruikt.                                      |
| `Migrations`                         | Een `fs.FS` met [migraties](migrations) die bij het starten worden uitgevoerd. |
| `Logger`                             | Krijgt elke query op debugniveau; standaard de logger van de applicatie.       |

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
