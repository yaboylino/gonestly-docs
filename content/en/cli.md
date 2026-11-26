---
title: CLI
description: The gonestly command line tool creates projects, generates code, runs the application in dev mode, manages migrations and inspects routes.
---

The `gonestly` command line tool takes care of the repetitive parts of building an application: creating a project, generating modules and resources, running the application while you work, and managing migrations.

## Installation

```sh
go install github.com/yaboylino/gonestly/cmd/gonestly@latest
```

## Commands

| Command                                                  | What it does                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `gonestly new <dir>`                                     | Creates a project that runs immediately.                                                               |
| `gonestly add database`                                  | Creates a database and connects the project to it; see [adding a database](#adding-a-database).        |
| `gonestly generate <kind> <name>`                        | Generates a resource, module, controller, service, guard or interceptor; see [generators](generators). |
| `gonestly generate columns`                              | Generates the typed columns of your models for the [query builder](queries#the-query-builder).         |
| `gonestly dev`                                           | Runs the application and checks and restarts it on every change; see [dev mode](dev-mode).             |
| `gonestly migrate up`, `down`, `status`, `create <name>` | Manages [migrations](migrations).                                                                      |
| `gonestly routes`                                        | Lists every route.                                                                                     |
| `gonestly openapi [-o file]`                             | Prints or writes the [OpenAPI](openapi) document.                                                      |
| `gonestly version`                                       | Prints the version of the tool.                                                                        |

Every command has `--help` with its flags and examples, and `gonestly completion` sets up tab completion for your shell.

## A new project

```sh
gonestly new shop --database postgres
cd shop
gonestly dev
```

| Flag         | Purpose                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `--module`   | The Go module path, such as `github.com/acme/shop`; it defaults to the directory name.                     |
| `--database` | `postgres`, `mysql` or `sqlite` adds the [database module](database), a driver and a migrations directory. |

The project is ready to run, with:

- a root module that loads the [configuration](configuration) from the environment and `.env`, enables [validation](validation) and imports the other modules,
- [health checks](health-checks) at `/health/live` and `/health/ready`, with a test,
- the [OpenAPI](openapi) documentation at `/docs`, which `DOCS=false` hides,
- a `.env` file with the port and the database, and a `.gitignore`.

```text
shop/
  main.go
  internal/
    app/        the root module and the configuration
    health/     the health checks and their test
  migrations/   SQL migrations, embedded in the binary
  .env
```

## Adding a database

> [!NOTE]
> `gonestly add database` is available from version 0.3.0.

A project made without `--database` can get one later. `gonestly add database` asks which database you want and how to reach it, creates the database on its server and connects the project to it:

```text
$ gonestly add database
Which database do you want to add?
  1) sqlite
  2) mysql
  3) postgres
Choose (sqlite): 3
Host (localhost): db.internal
Port (5432):
User (postgres): app
Password:
Name of the database (shop):
✓ created the database shop on db.internal:5432
```

The password is not shown while you type it. An empty answer takes the default between the brackets: the standard port of the database, `root` or `postgres` as the user, and the name of the project as the name of the database. For SQLite you only choose the file.

The command first checks that the server can be reached with these details and creates the database when it does not exist yet, so the user needs the right to create databases. Then it changes the project:

- `.env` gets `DATABASE_URL` with the password, and `.env.example` gets the same with a made up password. `.env` is readable by you alone and is already in `.gitignore`.
- The root module imports the [database module](database), the configuration gets a `DatabaseURL` field and `main.go` imports the driver.
- A `migrations` directory is added, ready for `gonestly generate resource` and `gonestly migrate create`.

Run it where there is no terminal, such as in a script, by giving every detail as a flag. The password comes from the environment, so it stays out of the process list and your shell history:

```sh
GONESTLY_DB_PASSWORD=secret gonestly add database postgres --host db.internal --user app --name shop
```

| Flag            | Purpose                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| `--host`        | The host of the server; `localhost` by default.                                            |
| `--port`        | The port of the server; 3306 for MySQL and 5432 for PostgreSQL by default.                 |
| `--user`        | The user to connect as; `root` for MySQL and `postgres` for PostgreSQL by default.         |
| `--password`    | The password; prefer `GONESTLY_DB_PASSWORD` or the prompt. `--password=` means none.       |
| `--name`        | The name of the database, or the file of a SQLite database.                                |
| `--ssl`         | The PostgreSQL `sslmode` or MySQL `tls` setting; off for this machine, on for other hosts. |
| `--skip-create` | Only connect the project, for a database that exists already or is made another way.       |

A project that already has a database is left alone: change `DATABASE_URL` in `.env` to use another one. The command expects the layout of `gonestly new`; for another layout, add the [module](database#connecting) by hand.

## Adding jobs

Add background jobs to a project that has a database:

```sh
gonestly add jobs
```

It writes a migration that creates the `gonestly_jobs` table and adds the jobs module to the root module. See [background jobs](background-jobs).

## Routes and OpenAPI

`gonestly routes` and `gonestly openapi` read the routes and the document from your application itself, so they always match what it serves:

```sh
gonestly routes
gonestly openapi -o openapi.json
```

```text
METHOD   PATH             CONTROLLER
GET      /health/live     health.NewController in module "health"
GET      /health/ready    health.NewController in module "health"
GET      /products        products.NewController in module "products"
POST     /products        products.NewController in module "products"
```

They build and start the application without listening on a port, by setting the environment variable `GONESTLY_INSPECT`. Providers start as usual, so the database connects and pending migrations are applied. The result is written to a file, so anything the application prints itself cannot end up in it.

## Migrations

`gonestly migrate` reads the database from `DATABASE_URL` in the environment or the `.env` file, and the migrations from the `migrations` directory:

```sh
gonestly migrate create add_product_price   # writes an empty up and down file
gonestly migrate status
gonestly migrate up
gonestly migrate down
```

New migrations follow the numbering of the existing ones: the next counter for versions like `0001`, or a timestamp. Pass `--dsn` to use another database. The driver (`pgx`, `mysql` or `sqlite`) follows from the connection string; set it with `--driver` when it cannot be told.
