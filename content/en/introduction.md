---
title: Introduction
description: Gonestly is a modular application framework for Go, inspired by NestJS, with dependency injection, typed configuration and a CLI.
---

Gonestly is a framework for building server applications in Go that stay easy to change as they grow. It borrows the architecture of [NestJS](https://nestjs.com): an application is a tree of **modules**, each module declares the **providers** it constructs, and the framework wires them together through **dependency injection**.

It does this in plain, idiomatic Go. There are no decorators to imitate, no code generation in your business logic and no reflection on every request. A provider is an ordinary constructor function, and a module is an ordinary struct.

> [!NOTE]
> Gonestly is at version `v0.1.0`, its first release. Until `v1.0.0` a minor version may change the API; the [changelog](https://github.com/yaboylino/gonestly/blob/main/CHANGELOG.md) lists every change.

## Philosophy

Go makes it easy to start a service and surprisingly hard to keep a large one tidy. Every team ends up inventing its own way to wire dependencies, start and stop components and load configuration. Gonestly gives those decisions one consistent shape, so that every Gonestly application is structured the same way and a new developer finds their way around quickly.

Three principles guide the design:

- **Fail at startup, not at runtime.** The whole dependency graph is checked when the application is built. A missing provider, a forgotten export or a dependency cycle is reported before anything runs, with a message that says how to fix it.
- **Plain Go first.** Constructors, interfaces, `context.Context` and `log/slog`. If you know Go, you can read a Gonestly application.
- **Standard library underneath.** Gonestly builds on `net/http`, `database/sql` and `log/slog`, so existing packages and middleware keep working.

## What is available today

| Part                                                                                                                              | Status    |
| --------------------------------------------------------------------------------------------------------------------------------- | --------- |
| [Modules](modules) and [providers](providers)                                                                                     | Available |
| [Lifecycle events](lifecycle-events) and graceful shutdown                                                                        | Available |
| [Configuration](configuration) from the environment and `.env` files                                                              | Available |
| [Testing](testing) with overrides                                                                                                 | Available |
| [Controllers](controllers), [validation](validation), [guards](guards) and [interceptors](interceptors)                           | Available |
| [OpenAPI](openapi) and Swagger UI for every route                                                                                 | Available |
| [Database](database): [repositories](repositories), [queries](queries), [transactions](transactions) and [migrations](migrations) | Available |
| The [CLI](cli) with [generators](generators) and a [dev mode](dev-mode)                                                           | Available |

## Next steps

Start with [first steps](first-steps) to build a small API, then read about [controllers](controllers), [providers](providers) and [modules](modules), the concepts everything else is built on.
