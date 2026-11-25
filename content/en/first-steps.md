---
title: First steps
description: Install Gonestly and build your first application with two modules, a provider and graceful shutdown.
---

In this guide you build a small application with two modules. Along the way you meet the core concepts: modules, providers and the application lifecycle.

## Prerequisites

You need **Go 1.26 or newer**. Check your version with:

```sh
go version
```

## Installation

Create a new module and add Gonestly to it:

```sh
mkdir shop && cd shop
go mod init example.com/shop
go get github.com/yaboylino/gonestly
```

> [!NOTE]
> The repository is not public yet. Until the first release, `go get` only works for people with access to it.

## A database module

Start with a module that provides a database connection. A provider is an ordinary constructor: Gonestly calls it once and shares the result with every provider that needs it.

```go title="database/module.go"
package database

import "github.com/yaboylino/gonestly"

type DB struct {
	DSN string
}

func NewDB() *DB {
	return &DB{DSN: "postgres://localhost/shop"}
}

var Module = &gonestly.Module{
	Name:      "database",
	Providers: gonestly.Providers(NewDB),
	Exports:   gonestly.Exports(NewDB),
}
```

The `Exports` field makes `*DB` available to every module that imports this one. Without it, `*DB` stays private to the database module.

## A users module

The users module imports the database module and asks for a `*database.DB` in its constructor. Gonestly sees the parameter and injects the instance.

```go title="users/module.go"
package users

import (
	"example.com/shop/database"
	"github.com/yaboylino/gonestly"
)

type Service struct {
	db *database.DB
}

func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

var Module = &gonestly.Module{
	Name:      "users",
	Imports:   gonestly.Imports(database.Module),
	Providers: gonestly.Providers(NewService),
	Exports:   gonestly.Exports(NewService),
}
```

## The application

Every application has one root module. Build it with `gonestly.New` and run it with `Run`, which starts every provider and waits for Ctrl+C or a termination signal before shutting down gracefully.

```go title="main.go"
package main

import (
	"context"
	"log"

	"example.com/shop/users"
	"github.com/yaboylino/gonestly"
)

var AppModule = &gonestly.Module{
	Name:    "app",
	Imports: gonestly.Imports(users.Module),
}

func main() {
	app, err := gonestly.New(AppModule)
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Run(context.Background()); err != nil {
		log.Fatal(err)
	}
}
```

Run it with `go run .`. The application logs that it started, and stops cleanly when you press Ctrl+C.

## When something is wrong

Remove `database.Module` from the imports of the users module and run the application again. It refuses to start and tells you exactly what is missing:

```text
gonestly: the application cannot be built:
  - missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" exports it: add that module to the Imports of "users"
```

Every problem in the module graph is reported at once, before a single constructor runs. The [error messages](error-messages) page lists them all.

## What is next

Read about [modules](modules) to learn how to organise a larger application, and [providers](providers) for everything you can inject.
