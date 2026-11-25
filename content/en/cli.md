---
title: CLI
description: The gonestly command line tool creates projects, generates code, runs the application in dev mode, manages migrations and inspects routes.
---

The `gonestly` command line tool takes care of the repetitive parts of building an application: creating a project, generating modules and resources, running the application while you work, and managing migrations.

## Installation

```sh
go install github.com/yaboylino/gonestly/cmd/gonestly@latest
```

> [!NOTE]
> The CLI can be installed this way from the first release on. Until then, build it from a checkout of the repository with `go build ./cmd/gonestly`.

## Commands

| Command                                                  | What it does                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `gonestly new <dir>`                                     | Creates a project that runs immediately.                                                               |
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

| Flag         | Purpose                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `--module`   | The Go module path, such as `github.com/acme/shop`; it defaults to the directory name.            |
| `--database` | `postgres` or `sqlite` adds the [database module](database), a driver and a migrations directory. |

The project is ready to run, with:

- a root module that loads the [configuration](configuration) from the environment and `.env`, enables [validation](validation) and imports the other modules,
- a health check at `/health` with a test,
- the [OpenAPI](openapi) documentation at `/docs`, which `DOCS=false` hides,
- a `.env` file with the port and the database, and a `.gitignore`.

```text
shop/
  main.go
  internal/
    app/        the root module and the configuration
    health/     the health check and its test
  migrations/   SQL migrations, embedded in the binary
  .env
```

## Routes and OpenAPI

`gonestly routes` and `gonestly openapi` read the routes and the document from your application itself, so they always match what it serves:

```sh
gonestly routes
gonestly openapi -o openapi.json
```

```text
METHOD   PATH             CONTROLLER
GET      /health          health.NewController in module "health"
GET      /products        products.NewController in module "products"
POST     /products        products.NewController in module "products"
```

They build and start the application without listening on a port, by setting the environment variable `GONESTLY_INSPECT`. Providers start as usual, so the database connects and pending migrations are applied.

## Migrations

`gonestly migrate` reads the database from `DATABASE_URL` in the environment or the `.env` file, and the migrations from the `migrations` directory:

```sh
gonestly migrate create add_product_price   # writes an empty up and down file
gonestly migrate status
gonestly migrate up
gonestly migrate down
```

New migrations follow the numbering of the existing ones: the next counter for versions like `0001`, or a timestamp. Pass `--dsn` and `--driver` to use another database.
