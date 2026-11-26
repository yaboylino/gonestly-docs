---
title: Roadmap
description: What Gonestly offers today and what comes next, from HTTP controllers to the SQL layer and the CLI.
---

Gonestly is built in phases. Each phase is finished, tested and documented before the next one starts, and `v0.1.0` is the first release.

## Available

- **Modules and dependency injection**, with imports, exports, global modules and validation of the whole graph at startup.
- **Lifecycle events**, graceful shutdown and stopping the application from a provider.
- **Configuration** from environment variables and `.env` files.
- **Testing** with overrides and requests without a port.
- **Database**: [repositories](repositories), a typed [query builder](queries), [transactions](transactions) and [migrations](migrations) for PostgreSQL, MySQL, MariaDB and SQLite.
- **HTTP** [controllers](controllers) with typed handlers, request binding, [validation](validation), [guards](guards), [interceptors](interceptors), [middleware](middleware) and problem details for errors.
- **OpenAPI** for every route, generated from the code and served with Swagger UI; see [OpenAPI](openapi).
- **CLI**: [new projects, generators](cli), a [dev mode](dev-mode) that stops the application when a change breaks it, and migrations.

## Next

Until `v1.0.0` the work goes to what real projects need: feedback on the API, more examples and fixes. Open an issue on GitHub to tell what you miss.

## Follow along

The [changelog](https://github.com/yaboylino/gonestly/blob/main/CHANGELOG.md) lists every change, and [GitHub](https://github.com/yaboylino/gonestly) is the place for questions and ideas.
