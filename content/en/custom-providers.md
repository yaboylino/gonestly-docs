---
title: Custom providers
description: Provide interfaces with As, existing values with Value, and share one instance under two types with Alias.
---

Most providers are constructors registered with `gonestly.Providers`. For the other cases, Gonestly has three building blocks: `As`, `Value` and `Alias`. Each returns a `gonestly.Provider` that you pass to `Providers` like a constructor.

## Interfaces with As

Constructors in Go return concrete types, but consumers often depend on an interface. `As` registers a constructor under an interface it implements:

```go title="users/module.go"
type Store interface {
	Find(ctx context.Context, id string) (*User, error)
}

type PostgresStore struct{ db *sql.DB }

func NewPostgresStore(db *sql.DB) *PostgresStore { return &PostgresStore{db: db} }

var Module = &gonestly.Module{
	Name: "users",
	Providers: gonestly.Providers(
		gonestly.As[Store](NewPostgresStore),
		NewService, // func NewService(store Store) *Service
	),
}
```

`NewService` now receives a `Store`, and nothing outside the module knows about `PostgresStore`. If the constructor's result does not implement the interface, the application refuses to start.

> [!HINT]
> If you forget `As` and register `NewPostgresStore` directly, the error message points it out: `*users.PostgresStore implements it: provide it with gonestly.As[users.Store](users.NewPostgresStore)`.

## Existing values with Value

`Value` provides a value you already have, such as a client created before the application starts:

```go
client := stripe.NewClient(apiKey)

var Module = &gonestly.Module{
	Name:      "billing",
	Providers: gonestly.Providers(gonestly.Value(client)),
}
```

The type is taken from the argument. Pass the type explicitly to provide the value as an interface:

```go
gonestly.Value[users.Store](memoryStore)
```

A nil value is rejected. Values run their [lifecycle hooks](lifecycle-events) like any other provider, so a value that implements `OnStop` is stopped with the application.

To export a value, use its type, since it has no constructor: `gonestly.Exports(gonestly.Type[*stripe.Client]())`.

## One instance, two types with Alias

Sometimes the same instance must be available as its concrete type and as an interface. Registering the constructor twice would construct it twice. `Alias` provides the existing instance under a second type instead:

```go
var Module = &gonestly.Module{
	Name: "users",
	Providers: gonestly.Providers(
		NewPostgresStore,
		gonestly.Alias[Store, *PostgresStore](),
	),
}
```

Providers that ask for `Store` and providers that ask for `*PostgresStore` receive the same instance, and its lifecycle hooks run once.

## Exporting custom providers

Pass the provider value to `Exports`, or export its type:

```go
store := gonestly.As[Store](NewPostgresStore)

var Module = &gonestly.Module{
	Name:      "users",
	Providers: []gonestly.Provider{store},
	Exports:   gonestly.Exports(store), // or gonestly.Type[Store]()
}
```

If a single constructor backs two providers, for example once directly and once through `As`, exporting the constructor is ambiguous. Gonestly reports it and asks you to export with `gonestly.Type` instead.
