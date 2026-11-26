---
title: Database
description: Connect to PostgreSQL, MySQL or SQLite with the sql module, which provides the database to every module and closes it on shutdown.
---

The `sql` module is the SQL layer of Gonestly. It builds on `database/sql` from the standard library and works with PostgreSQL, MySQL, MariaDB and SQLite. It lives in its own Go module, so the framework stays free of dependencies, and you choose the driver:

```sh
go get github.com/yaboylino/gonestly/sql
go get github.com/jackc/pgx/v5         # PostgreSQL
go get github.com/go-sql-driver/mysql  # MySQL and MariaDB
go get modernc.org/sqlite              # SQLite, without cgo
```

The SQL layer works at three levels, and you can mix them freely:

| Level                                          | Use it for                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| [Repositories](repositories)                   | Create, read, update and delete by primary key, without writing SQL. |
| [The query builder](queries#the-query-builder) | Typed queries with conditions, ordering and paging.                  |
| [Raw SQL](queries#raw-sql)                     | Everything else, scanned straight into structs.                      |

## Connecting

Import `sql.Module` in the root module. It connects when the application starts, checks the connection, applies the [migrations](migrations) and provides a `*sql.DB` to every module:

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

The blank import registers the driver with `database/sql`. Each database has its own import and driver name:

| Database          | Import                               | `Driver` | Example of a `DSN`                      |
| ----------------- | ------------------------------------ | -------- | --------------------------------------- |
| PostgreSQL        | `_ "github.com/jackc/pgx/v5/stdlib"` | `pgx`    | `postgres://user:secret@localhost/shop` |
| MySQL and MariaDB | `_ "github.com/go-sql-driver/mysql"` | `mysql`  | `user:secret@tcp(localhost:3306)/shop`  |
| SQLite            | `_ "modernc.org/sqlite"`             | `sqlite` | `file:shop.db`                          |

When the application stops, the connection pool is closed after the HTTP server has finished its requests.

If the database cannot be reached, the application does not start, and the error names the cause. A driver that is not imported is reported with the import line to add.

## From your configuration

The connection string usually comes from the environment. `sql.ModuleFunc` builds the options from a provider of a global module, such as the [configuration](configuration):

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

## Options

| Option                               | Purpose                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `Driver`                             | The name of a registered `database/sql` driver, such as `pgx`, `mysql` or `sqlite`. |
| `DSN`                                | The connection string for the driver.                                               |
| `Dialect`                            | `sql.Postgres`, `sql.MySQL` or `sql.SQLite`; inferred from the driver names above.  |
| `MaxOpenConns`, `MaxIdleConns`       | The size of the connection pool.                                                    |
| `ConnMaxLifetime`, `ConnMaxIdleTime` | How long connections are reused.                                                    |
| `Migrations`                         | An `fs.FS` with [migrations](migrations) to apply at startup.                       |
| `Logger`                             | Receives every query at debug level; it defaults to the application's logger.       |

## MySQL and MariaDB

The same code runs on every database: write `?` for arguments, and the repositories, the query builder, transactions and migrations behave the same. A few things are worth knowing about MySQL and MariaDB:

- **The connection string is not a URL.** It has the form `user:password@tcp(host:3306)/database`.
- **Dates and times work out of the box.** Gonestly adds `parseTime=true` to the connection string when you leave it out, so a `DATETIME` column scans into a `time.Time`.
- **Only an auto increment key is generated for you.** [Repositories](repositories) read it back after an insert. Any other key, such as a UUID, must be set before `Create`.
- **A schema change commits on its own.** A [migration](migrations) that fails halfway keeps the tables it already created.

## Using the database

Any provider can inject the `*sql.DB`:

```go
func NewReportService(db *sql.DB) *ReportService {
	return &ReportService{db: db}
}
```

`db.Exec` runs a statement, `db.Transaction` starts a [transaction](transactions) and `db.Std()` returns the underlying `*sql.DB` of `database/sql`, for libraries that need it.

## Models

A model is a struct whose fields map to columns. The column name is the `db` tag, or the field name in snake case, so `CreatedAt` maps to `created_at`:

```go title="users/user.go"
type User struct {
	ID        int64     `db:"id"`
	Name      string    `db:"name"`
	Email     *string   `db:"email"`              // a pointer holds NULL
	CreatedAt time.Time `db:"created_at,default"` // filled in by the database
	Password  string    `db:"-"`                  // never read or written
}
```

| Tag             | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `db:"name"`     | The column name.                                                      |
| `db:",pk"`      | The primary key. Without it, the field named `ID` is the primary key. |
| `db:",default"` | Left to the database on insert when zero, such as a creation time.    |
| `db:"-"`        | Not a column.                                                         |

The table name is the plural of the type name in snake case, so `OrderItem` uses `order_items`. For other names, add a method:

```go
func (Person) TableName() string { return "people" }
```

Fields of embedded structs become columns of the model, which is useful for shared columns such as timestamps. Nullable columns use pointers or the `sql.Null` types of `database/sql`, and any type that implements `sql.Scanner` and `driver.Valuer` works, such as `uuid.UUID`.

Mistakes in a model, such as two fields for one column or a struct field that is not a column, are reported with the field name the first time the model is used. [Repositories](repositories) check their model when the application starts.
