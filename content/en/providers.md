---
title: Providers
description: Providers are constructors whose results Gonestly injects into each other, with support for errors, context and singletons.
---

A provider is anything the application constructs and injects: a service, a repository, a client, a configuration value. In Gonestly a provider is an ordinary constructor function. Its parameters are its dependencies, and its result is what it provides.

```go title="users/service.go"
type Service struct {
	repo   *Repository
	logger *slog.Logger
}

func NewService(repo *Repository, logger *slog.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}
```

Register it in a module, and every provider in that module can ask for a `*Service`:

```go
var Module = &gonestly.Module{
	Name:      "users",
	Providers: gonestly.Providers(NewRepository, NewService),
}
```

## Constructors

A constructor can take any number of parameters and returns one of two shapes:

```go
func NewCache() *Cache                         // a value
func NewClient(cfg Config) (*Client, error)    // a value and an error
```

If a constructor returns an error, the application does not start. The error is reported with the name of the constructor and its module:

```text
gonestly: constructing database.Open in module "database": dial tcp 127.0.0.1:5432: connection refused
```

A constructor that panics or returns a nil value is reported the same way, so a broken provider never surfaces later as a nil pointer somewhere else.

Constructors must not be variadic, and they must return a value: a function that only returns an error is not a provider.

## Singletons

Every provider is constructed exactly once per application, in dependency order, and the same instance is injected everywhere it is needed. Two services that both ask for `*database.DB` receive the same connection.

Gonestly constructs every provider when the application starts, also the ones nothing depends on yet. That way a misconfigured provider fails at startup instead of on the first request that happens to need it.

## Injecting the context

A parameter of type `context.Context` receives the context passed to `App.Start`, or to `App.Run`. Use it for work during construction, such as connecting to a database with a timeout:

```go
func Open(ctx context.Context, cfg Config) (*sql.DB, error) {
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	return db, db.PingContext(ctx)
}
```

> [!WARNING]
> Do not keep this context for background work. It belongs to the startup phase; start long running work in [OnStart](lifecycle-events) and stop it in OnStop.

## Built-in providers

Every module can inject these without importing anything:

| Type                  | What it is                                                       |
| --------------------- | ---------------------------------------------------------------- |
| `*slog.Logger`        | The application's logger, configured with `gonestly.WithLogger`. |
| `gonestly.Shutdowner` | Stops the application, for example when a server fails.          |
| `context.Context`     | The startup context, see [above](#injecting-the-context).        |

## Interfaces and values

Constructors usually return concrete types. To inject an interface instead, register the constructor with `gonestly.As`. To provide a value you already have, use `gonestly.Value`. Both are described in [custom providers](custom-providers).

## Missing dependencies

If a constructor asks for a type that is not available in its module, the application refuses to start. The message explains where the type is provided and what to change:

```text
missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" provides it but does not export it: add it to the Exports of "database" and import that module
```

Gonestly also recognises common mistakes: asking for `*Config` while `Config` is provided, or asking for an interface that a provider implements without being registered with `As`. See [error messages](error-messages).
