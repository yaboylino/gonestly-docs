---
title: Error messages
description: Every error Gonestly reports when building or starting an application, what it means and how to fix it.
---

Gonestly validates the whole module graph in `gonestly.New`, before anything is constructed, and reports every problem at once in a `*gonestly.BuildError`:

```text
gonestly: the application cannot be built:
  - missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" exports it: add that module to the Imports of "users"
  - dependency cycle: orders.NewService -> billing.NewService -> orders.NewService
```

## Inspecting errors

Each problem wraps a sentinel error, so you can check for a kind of problem with `errors.Is`:

| Error                           | Meaning                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `gonestly.ErrMissingDependency` | A provider needs a type that is not available in its module. |
| `gonestly.ErrDependencyCycle`   | Providers or modules depend on each other in a circle.       |
| `gonestly.ErrInvalidModule`     | A module, provider or export is declared incorrectly.        |
| `gonestly.ErrInvalidRoute`      | A route is declared incorrectly or conflicts with another.   |
| `gonestly.ErrNotStarted`        | `Resolve` was called on an application that is not running.  |

The individual problems are available as `BuildError.Problems`.

## Missing dependencies

The message names the provider, its module and the type it needs, followed by a hint:

| Hint                                                           | What to do                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `module "x" exports it: add that module to the Imports of "y"` | Import module `x` in module `y`.                                              |
| `module "x" provides it but does not export it`                | Add the provider to the `Exports` of `x`, and import `x` if you have not yet. |
| `T is available: did you mean that type?`                      | You asked for `*T` while `T` is provided, or the other way around.            |
| `*Impl implements it: provide it with gonestly.As[...]`        | Register the implementation with [As](custom-providers#interfaces-with-as).   |
| `no module provides it`                                        | Add a provider for the type.                                                  |

## Dependency cycles

A cycle lists the providers involved, ending where it started:

```text
dependency cycle: orders.NewService -> billing.NewService -> orders.NewService
```

Break it by moving the shared logic into a third provider that both depend on, or by depending on a smaller interface. Modules that import each other are reported as `modules import each other: "a" -> "b" -> "a"`.

## Invalid declarations

| Message                                        | Cause                                                      |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `int is not a constructor function`            | Something other than a function was passed to `Providers`. |
| `must return a value, or a value and an error` | The constructor returns nothing, or only an error.         |
| `must not be variadic`                         | Constructors cannot take `...` parameters.                 |
| `provides T twice`                             | A module registers two providers of the same type.         |
| `exports X, which is not one of its providers` | An export does not match a provider of the module.         |
| `exports module "x", which it does not import` | Only imported modules can be re-exported.                  |
| `two different modules are named "x"`          | Module names must be unique, and `gonestly` is reserved.   |
| `override X replaces no provider of T`         | An override in a test does not match any provider.         |

## Invalid routes

Routes are registered when the application starts, and `Start` reports every problem before the server listens. Each message names the route and its controller:

```text
invalid route: GET /users/{userId} in users.NewController in module "users": FindOneRequest.ID reads the path value "id", but the path /users/{userId} has no {id} wildcard
```

| Message                                                          | Cause                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `reads the path value "x", but the path ... has no {x} wildcard` | A `path` tag does not match the route.                                  |
| `has type T, which cannot be read from the query`                | The field type cannot be parsed from text.                              |
| `has more than one of the tags query, header`                    | A field can come from one place only.                                   |
| `the request type *T must be a struct, a slice or a map`         | Use the struct itself, not a pointer to it.                             |
| `the status 404 is not a success status`                         | `gonestly.Status` is for successful responses; return an error instead. |
| `conflicts with pattern`                                         | Two routes match the same requests.                                     |
| `has no Routes(*gonestly.Router) method`                         | A type in `Controllers` is not a controller.                            |

## Database errors

The [SQL layer](database) reports its problems with these errors:

| Error                 | Meaning                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| `sql.ErrNotFound`     | A query found no row. Returned from a handler, it answers 404.                         |
| `sql.ErrConflict`     | A unique or primary key value already exists. Returned from a handler, it answers 409. |
| `sql.ErrTooManyRows`  | `QueryOne` found more than one row.                                                    |
| `sql.ErrUnsafeQuery`  | An update or delete has no condition; use `sql.Always()` to affect every row.          |
| `sql.ErrInvalidModel` | A struct cannot be mapped to a table, for example because two fields use one column.   |

Scanning reports a column without a matching field by name, such as `the column "email" has no field in User; add a field with db:"email"`, and placeholder mistakes as `the query has 1 placeholders but 2 arguments`. See [migrations](migrations#safety-checks) for the messages of the migrator.

## Errors while starting

Errors from constructors and start hooks are returned by `Start` and `Run`, with the provider and module:

```text
gonestly: constructing database.Open in module "database": connection refused
gonestly: starting worker.NewWorker in module "worker": queue unavailable
```

A panic is reported as `panic: <value>`, and a constructor that returns nil as `returned a nil *T`. Configuration errors start with `config:`; see [configuration](configuration#errors).
