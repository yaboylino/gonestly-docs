---
title: CLI
description: De command line tool gonestly maakt projecten, genereert code, draait de applicatie in de dev-modus, beheert migraties en toont routes.
---

De command line tool `gonestly` neemt het herhaalwerk van het bouwen van een applicatie over: een project aanmaken, modules en resources genereren, de applicatie draaien terwijl je werkt, en migraties beheren.

## Installatie

```sh
go install github.com/yaboylino/gonestly/cmd/gonestly@latest
```

> [!NOTE]
> Vanaf de eerste release is de CLI zo te installeren. Tot die tijd bouw je hem vanuit een checkout van de repository met `go build ./cmd/gonestly`.

## Commando's

| Commando                                                 | Wat het doet                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gonestly new <map>`                                     | Maakt een project dat direct draait.                                                                     |
| `gonestly generate <soort> <naam>`                       | Genereert een resource, module, controller, service, guard of interceptor; zie [generators](generators). |
| `gonestly generate columns`                              | Genereert de getypeerde kolommen van je modellen voor de [querybuilder](queries#de-querybuilder).        |
| `gonestly dev`                                           | Draait de applicatie en controleert en herstart hem bij elke wijziging; zie [dev-modus](dev-mode).       |
| `gonestly migrate up`, `down`, `status`, `create <naam>` | Beheert [migraties](migrations).                                                                         |
| `gonestly routes`                                        | Toont elke route.                                                                                        |
| `gonestly openapi [-o bestand]`                          | Toont of schrijft het [OpenAPI](openapi)-document.                                                       |
| `gonestly version`                                       | Toont de versie van de tool.                                                                             |

Elk commando heeft `--help` met zijn opties en voorbeelden, en `gonestly completion` stelt automatisch aanvullen met Tab in voor je shell.

## Een nieuw project

```sh
gonestly new shop --database postgres
cd shop
gonestly dev
```

| Optie        | Doel                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `--module`   | Het Go-modulepad, zoals `github.com/acme/shop`; standaard de naam van de map.                                  |
| `--database` | `postgres`, `mysql` of `sqlite` voegt de [databasemodule](database), een driver en een map voor migraties toe. |

Het project is direct klaar om te draaien, met:

- een rootmodule die de [configuratie](configuration) uit de omgeving en `.env` laadt, [validatie](validation) aanzet en de andere modules importeert,
- een health check op `/health` met een test,
- de [OpenAPI](openapi)-documentatie op `/docs`, die je met `DOCS=false` verbergt,
- een `.env`-bestand met de poort en de database, en een `.gitignore`.

```text
shop/
  main.go
  internal/
    app/        de rootmodule en de configuratie
    health/     de health check en zijn test
  migrations/   SQL-migraties, ingebed in de binary
  .env
```

## Routes en OpenAPI

`gonestly routes` en `gonestly openapi` lezen de routes en het document uit je applicatie zelf, zodat ze altijd kloppen met wat hij serveert:

```sh
gonestly routes
gonestly openapi -o openapi.json
```

```text
METHOD   PATH             CONTROLLER
GET      /health          health.NewController in module "health"
GET      /products        products.NewController in module "products"
POST     /products        products.NewController in module "products"
```

Ze bouwen en starten de applicatie zonder op een poort te luisteren, via de omgevingsvariabele `GONESTLY_INSPECT`. Providers starten gewoon, dus de database verbindt en openstaande migraties worden uitgevoerd. Het resultaat gaat naar een bestand, zodat wat de applicatie zelf print er niet in terecht kan komen.

## Migraties

`gonestly migrate` leest de database uit `DATABASE_URL` in de omgeving of het `.env`-bestand, en de migraties uit de map `migrations`:

```sh
gonestly migrate create add_product_price   # schrijft een leeg up- en down-bestand
gonestly migrate status
gonestly migrate up
gonestly migrate down
```

Nieuwe migraties volgen de nummering van de bestaande: de volgende teller voor versies als `0001`, of een tijdstempel. Geef `--dsn` mee om een andere database te gebruiken. De driver (`pgx`, `mysql` of `sqlite`) volgt uit de connection string; zet hem met `--driver` als dat niet lukt.
