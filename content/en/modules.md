---
title: Modules
description: Modules group related providers and declare which of them other modules may use, through imports and exports.
---

A module groups the providers that belong to one feature, such as users, billing or the database, and declares which of them the rest of the application may use. Every application has a root module, and the modules it imports form a tree.

```go title="users/module.go"
var Module = &gonestly.Module{
	Name:      "users",
	Imports:   gonestly.Imports(database.Module),
	Providers: gonestly.Providers(NewRepository, NewService),
	Exports:   gonestly.Exports(NewService),
}
```

| Field         | Purpose                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `Name`        | Identifies the module in error messages and logs. It must be unique within the application.              |
| `Imports`     | Modules whose exported providers this module can inject.                                                 |
| `Providers`   | Constructors and values that the application builds for this module. See [providers](providers).         |
| `Controllers` | Controllers that handle HTTP requests with the module's providers. See [controllers](controllers).       |
| `Exports`     | The providers that modules importing this one can inject.                                                |
| `Global`      | Makes the exports available to every module without importing it. See [global modules](#global-modules). |

## Declaring a module

Declare each module once, as a package-level pointer, and import that pointer wherever it is needed. A module is identified by its pointer, so the same module imported by ten other modules is still constructed only once.

> [!WARNING]
> Do not build modules inside a function that is called more than once. Two different `*gonestly.Module` values with the same name are reported as a conflict.

## Encapsulation

Providers are private to their module by default. A module can only inject:

- its own providers,
- the exports of the modules it imports,
- the exports of [global modules](#global-modules).

In the example above, `NewRepository` is an implementation detail of the users module: other modules cannot inject it, so you can change it freely. Only the service is part of the module's public surface.

## Exports

Export a provider by passing its constructor to `Exports`. For a provider created with `gonestly.Value`, which has no constructor, export its type with `gonestly.Type`:

```go
var Module = &gonestly.Module{
	Name:      "settings",
	Providers: gonestly.Providers(NewStore, gonestly.Value(defaults)),
	Exports:   gonestly.Exports(NewStore, gonestly.Type[Defaults]()),
}
```

You can also pass a `Provider` value to `Exports`, which is convenient for providers created with `As` or `Alias`. See [custom providers](custom-providers).

## Re-exporting modules

A module can pass on everything an imported module exports by exporting the module itself. This lets you bundle a few low level modules into one:

```go title="core/module.go"
var Module = &gonestly.Module{
	Name:    "core",
	Imports: gonestly.Imports(database.Module, cache.Module),
	Exports: gonestly.Exports(database.Module, cache.Module),
}
```

Modules that import `core.Module` can now inject everything that the database and cache modules export.

## Global modules

Some providers are needed nearly everywhere, such as configuration. Instead of importing their module in every feature module, mark it as global:

```go
var Module = &gonestly.Module{
	Name:      "config",
	Global:    true,
	Providers: gonestly.Providers(LoadConfig),
	Exports:   gonestly.Exports(LoadConfig),
}
```

A global module still has to be imported once, usually by the root module, so that it becomes part of the application. Its exports are then visible in every module.

> [!HINT]
> Use global modules sparingly. Explicit imports document which features depend on what, and they keep modules easy to test in isolation.

## Resolution rules

When a provider asks for a type, Gonestly looks in this order and the first match wins:

- the module's own providers,
- the exports of its imports,
- the exports of global modules.

If two imported modules export different providers of the same type, the application refuses to start and asks you to export it from one of them only. The same applies to two global modules.

## Built-in providers

Gonestly adds a global module named `gonestly` to every application. It provides:

- `*slog.Logger`, the logger set with `gonestly.WithLogger` or `slog.Default()`,
- `gonestly.Shutdowner`, to stop the application from a provider. See [lifecycle events](lifecycle-events#stopping-from-a-provider).

The name `gonestly` is reserved for this module.
