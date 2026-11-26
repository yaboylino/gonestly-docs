---
title: First steps
description: Install Gonestly and build your first API with two modules, a provider, a controller and graceful shutdown.
---

In this guide you build a small API with two modules. Along the way you meet the core concepts: modules, providers, controllers and the application lifecycle.

## Prerequisites

You need **Go 1.26 or newer**. Check your version with:

```sh
go version
```

## The quick way

The [CLI](cli) creates a project that runs immediately, with configuration, validation, a health check and the API documentation:

```sh
go install github.com/yaboylino/gonestly/cmd/gonestly@latest
gonestly new shop --database sqlite
cd shop
gonestly generate resource products
gonestly dev
```

If your shell cannot find `gonestly` after installation, add your Go binary directory to `PATH`. It is `$(go env GOPATH)/bin` by default or the directory set in `GOBIN`.

Open http://localhost:3000/docs and the products API is there, ready to try. The rest of this guide builds a small API by hand, so you see what each part does.

See [project structure](project-structure) for where to put DTOs, enums, and other files as the project grows.

## Installation

Create a new module and add Gonestly to it:

```sh
mkdir shop && cd shop
go mod init example.com/shop
go get github.com/yaboylino/gonestly
```

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

```go title="users/service.go"
package users

import (
	"context"

	"example.com/shop/database"
	"github.com/yaboylino/gonestly"
)

type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Service struct {
	db *database.DB
}

func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Find(ctx context.Context, id string) (*User, error) {
	if id != "1" {
		return nil, gonestly.NotFound("user %s does not exist", id)
	}
	return &User{ID: "1", Name: "Ada"}, nil
}
```

## A controller

A controller turns HTTP requests into calls to the service. The request type says where each value comes from; here the `id` comes from the path:

```go title="users/controller.go"
package users

import (
	"context"

	"github.com/yaboylino/gonestly"
)

type FindRequest struct {
	ID string `path:"id"`
}

type Controller struct {
	users *Service
}

func NewController(users *Service) *Controller {
	return &Controller{users: users}
}

func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/users")
	gonestly.Get(r, "/{id}", c.Find)
}

func (c *Controller) Find(ctx context.Context, req FindRequest) (*User, error) {
	return c.users.Find(ctx, req.ID)
}
```

Register the service and the controller in the module:

```go title="users/module.go"
package users

import (
	"example.com/shop/database"
	"github.com/yaboylino/gonestly"
)

var Module = &gonestly.Module{
	Name:        "users",
	Imports:     gonestly.Imports(database.Module),
	Providers:   gonestly.Providers(NewService),
	Controllers: gonestly.Controllers(NewController),
}
```

## The application

Every application has one root module. Build it with `gonestly.New` and run it with `Run`, which starts every provider and the HTTP server, and waits for Ctrl+C or a termination signal before shutting down gracefully.

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

Run it with `go run .` and call the API:

```sh
curl localhost:3000/users/1
# {"id":"1","name":"Ada"}

curl localhost:3000/users/2
# {"type":"about:blank","title":"Not Found","status":404,"detail":"user 2 does not exist","instance":"/users/2"}
```

Open http://localhost:3000/docs to see the API in Swagger UI, generated from your code; see [OpenAPI](openapi). The server listens on port 3000 by default; the [HTTP server](http-server) page explains how to change it. Press Ctrl+C and the application stops cleanly, after finishing the requests that are still running.

## When something is wrong

Remove `database.Module` from the imports of the users module and run the application again. It refuses to start and tells you exactly what is missing:

```text
gonestly: the application cannot be built:
  - missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" exports it: add that module to the Imports of "users"
```

Every problem in the module graph is reported at once, before a single constructor runs. The [error messages](error-messages) page lists them all.

## What is next

Read about [controllers](controllers) for everything a route can do, [modules](modules) to organise a larger application and [providers](providers) for everything you can inject.
