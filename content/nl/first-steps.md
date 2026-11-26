---
title: Eerste stappen
description: Installeer Gonestly en bouw je eerste API met twee modules, een provider, een controller en netjes afsluiten.
---

In deze handleiding bouw je een kleine API met twee modules. Onderweg leer je de kernbegrippen kennen: modules, providers, controllers en de lifecycle van de applicatie.

## Vereisten

Je hebt **Go 1.26 of nieuwer** nodig. Controleer je versie met:

```sh
go version
```

## De snelle manier

De [CLI](cli) maakt een project dat direct draait, met configuratie, validatie, een health check en de API-documentatie:

```sh
go install github.com/yaboylino/gonestly/cmd/gonestly@latest
gonestly new shop --database sqlite
cd shop
gonestly generate resource products
gonestly dev
```

Kan je shell `gonestly` na de installatie niet vinden? Voeg dan de map met Go-programma’s toe aan je `PATH`. Dat is standaard `$(go env GOPATH)/bin`, of de map die je in `GOBIN` hebt ingesteld.

Open http://localhost:3000/docs en de products-API staat klaar om uit te proberen. De rest van deze handleiding bouwt met de hand een kleine API, zodat je ziet wat elk onderdeel doet.

## Installatie

Maak een nieuwe module en voeg Gonestly toe:

```sh
mkdir shop && cd shop
go mod init example.com/shop
go get github.com/yaboylino/gonestly
```

## Een databasemodule

Begin met een module die een databaseverbinding levert. Een provider is een gewone constructor: Gonestly roept hem één keer aan en deelt het resultaat met elke provider die het nodig heeft.

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

Door het veld `Exports` is `*DB` beschikbaar voor elke module die deze module importeert. Zonder dat veld blijft `*DB` privé binnen de databasemodule.

## Een usersmodule

De usersmodule importeert de databasemodule en vraagt in zijn constructor om een `*database.DB`. Gonestly ziet de parameter en injecteert de instantie.

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

## Een controller

Een controller vertaalt HTTP-requests naar aanroepen van de service. Het requesttype zegt waar elke waarde vandaan komt; hier komt de `id` uit het pad:

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

Registreer de service en de controller in de module:

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

## De applicatie

Elke applicatie heeft één rootmodule. Bouw hem met `gonestly.New` en draai hem met `Run`. Die start elke provider en de HTTP-server, en wacht op Ctrl+C of een stopsignaal, waarna de applicatie netjes afsluit.

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

Start hem met `go run .` en roep de API aan:

```sh
curl localhost:3000/users/1
# {"id":"1","name":"Ada"}

curl localhost:3000/users/2
# {"type":"about:blank","title":"Not Found","status":404,"detail":"user 2 does not exist","instance":"/users/2"}
```

Open http://localhost:3000/docs om de API in Swagger UI te zien, gegenereerd uit je code; zie [OpenAPI](openapi). De server luistert standaard op poort 3000; de pagina [HTTP-server](http-server) legt uit hoe je dat aanpast. Druk op Ctrl+C en de applicatie stopt netjes, nadat de lopende requests zijn afgerond.

## Als er iets mis is

Haal `database.Module` weg uit de imports van de usersmodule en start de applicatie opnieuw. Hij weigert te starten en vertelt precies wat er ontbreekt:

```text
gonestly: the application cannot be built:
  - missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" exports it: add that module to the Imports of "users"
```

Alle problemen in de modulegraaf worden tegelijk gemeld, voordat er ook maar één constructor draait. De pagina [foutmeldingen](error-messages) zet ze allemaal op een rij.

## Hoe nu verder

Lees over [controllers](controllers) voor alles wat een route kan, over [modules](modules) om een grotere applicatie in te delen en over [providers](providers) voor alles wat je kunt injecteren.
