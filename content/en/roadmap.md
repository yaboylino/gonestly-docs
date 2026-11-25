---
title: Roadmap
description: What Gonestly offers today and what comes next, from HTTP controllers to the SQL layer and the CLI.
---

Gonestly is built in phases. Each phase is finished, tested and documented before the next one starts, and the first public release follows once OpenAPI and the CLI are in place.

## Available

- **Modules and dependency injection**, with imports, exports, global modules and validation of the whole graph at startup.
- **Lifecycle events**, graceful shutdown and stopping the application from a provider.
- **Configuration** from environment variables and `.env` files.
- **Testing** with overrides and requests without a port.
- **Database**: [repositories](repositories), a typed [query builder](queries), [transactions](transactions) and [migrations](migrations) for PostgreSQL and SQLite.
- **HTTP** [controllers](controllers) with typed handlers, request binding, [validation](validation), [guards](guards), [interceptors](interceptors), [middleware](middleware) and problem details for errors.

## OpenAPI

An OpenAPI document generated automatically for every route, from its path, parameters, request and response types and validation rules, served together with Swagger UI. Like FastAPI, the documentation follows from the code, without annotations. This is the next phase.

## MySQL

MySQL support for the SQL layer, after PostgreSQL and SQLite.

## CLI

- `gonestly new` creates a project that runs immediately.
- `gonestly generate` creates modules, controllers, services and complete CRUD resources, and registers them in the right module.
- `gonestly dev` watches the project and checks it on every save: it builds the code, runs `go vet` and, with `--test`, the tests of the packages you changed. When everything passes, the application restarts. When something fails, the application stops and every problem is listed with its file and line, so a broken change never looks like it works.
- `gonestly migrate`, `gonestly routes` and `gonestly openapi`.

## Follow along

The [changelog](https://github.com/yaboylino/gonestly/blob/main/CHANGELOG.md) lists every change, and [GitHub](https://github.com/yaboylino/gonestly) is the place for questions and ideas.
