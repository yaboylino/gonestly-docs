---
title: Eerste stappen
description: Installeer Gonestly en bouw je eerste applicatie met twee modules, een provider en netjes afsluiten.
---

In deze handleiding bouw je een kleine applicatie met twee modules. Onderweg leer je de kernbegrippen kennen: modules, providers en de lifecycle van de applicatie.

## Vereisten

Je hebt **Go 1.26 of nieuwer** nodig. Controleer je versie met:

```sh
go version
```

## Installatie

Maak een nieuwe module en voeg Gonestly toe:

```sh
mkdir shop && cd shop
go mod init example.com/shop
go get github.com/yaboylino/gonestly
```

> [!NOTE]
> De repository is nog niet openbaar. Tot de eerste release werkt `go get` alleen voor mensen met toegang.

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

## De applicatie

Elke applicatie heeft één rootmodule. Bouw hem met `gonestly.New` en draai hem met `Run`. Die start elke provider en wacht op Ctrl+C of een stopsignaal, waarna de applicatie netjes afsluit.

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

Start hem met `go run .`. De applicatie logt dat hij gestart is en stopt netjes als je op Ctrl+C drukt.

## Als er iets mis is

Haal `database.Module` weg uit de imports van de usersmodule en start de applicatie opnieuw. Hij weigert te starten en vertelt precies wat er ontbreekt:

```text
gonestly: the application cannot be built:
  - missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" exports it: add that module to the Imports of "users"
```

Alle problemen in de modulegraaf worden tegelijk gemeld, voordat er ook maar één constructor draait. De pagina [foutmeldingen](error-messages) zet ze allemaal op een rij.

## Hoe nu verder

Lees over [modules](modules) om een grotere applicatie in te delen, en over [providers](providers) voor alles wat je kunt injecteren.
