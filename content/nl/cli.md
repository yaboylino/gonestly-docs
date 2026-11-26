---
title: CLI
description: De command line tool gonestly maakt projecten, genereert code, draait de applicatie in de dev-modus, beheert migraties en toont routes.
---

De command line tool `gonestly` neemt het herhaalwerk van het bouwen van een applicatie over: een project aanmaken, modules en resources genereren, de applicatie draaien terwijl je werkt, en migraties beheren.

## Installatie

```sh
go install github.com/yaboylino/gonestly/cmd/gonestly@latest
```

## Commando's

| Commando                                                 | Wat het doet                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gonestly new <map>`                                     | Maakt een project dat direct draait.                                                                     |
| `gonestly add database`                                  | Maakt een database en verbindt het project ermee; zie [een database toevoegen](#een-database-toevoegen). |
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
- [health-checks](health-checks) op `/health/live` en `/health/ready`, met een test,
- de [OpenAPI](openapi)-documentatie op `/docs`, die je met `DOCS=false` verbergt,
- een `.env`-bestand met de poort en de database, en een `.gitignore`.

```text
shop/
  main.go
  internal/
    app/        de rootmodule en de configuratie
    health/     de health-checks en hun test
  migrations/   SQL-migraties, ingebed in de binary
  .env
```

## Een database toevoegen

Een project dat zonder `--database` is gemaakt kan er later een krijgen. `gonestly add database` vraagt welke database je wilt en hoe je erbij komt, maakt de database aan op zijn server en verbindt het project ermee:

```text
$ gonestly add database
Which database do you want to add?
  1) sqlite
  2) mysql
  3) postgres
Choose (sqlite): 3
Host (localhost): db.internal
Port (5432):
User (postgres): app
Password:
Name of the database (shop):
✓ created the database shop on db.internal:5432
```

Het wachtwoord is niet te zien terwijl je het typt. Een leeg antwoord neemt de standaard tussen haakjes: de standaardpoort van de database, `root` of `postgres` als gebruiker, en de naam van het project als naam van de database. Bij SQLite kies je alleen het bestand.

Het commando controleert eerst of de server met deze gegevens te bereiken is en maakt de database aan als hij nog niet bestaat, dus de gebruiker moet databases mogen aanmaken. Daarna past het het project aan:

- `.env` krijgt `DATABASE_URL` met het wachtwoord, en `.env.example` hetzelfde met een verzonnen wachtwoord. `.env` is alleen door jou te lezen en staat al in `.gitignore`.
- De root-module importeert de [databasemodule](database), de configuratie krijgt een veld `DatabaseURL` en `main.go` importeert de driver.
- Er komt een map `migrations`, klaar voor `gonestly generate resource` en `gonestly migrate create`.

Draai het waar geen terminal is, zoals in een script, door elk gegeven als flag mee te geven. Het wachtwoord komt uit de omgeving, zodat het niet in de proceslijst en je shell-geschiedenis staat:

```sh
GONESTLY_DB_PASSWORD=secret gonestly add database postgres --host db.internal --user app --name shop
```

| Flag            | Doel                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `--host`        | De host van de server; standaard `localhost`.                                                    |
| `--port`        | De poort van de server; standaard 3306 voor MySQL en 5432 voor PostgreSQL.                       |
| `--user`        | De gebruiker om mee te verbinden; standaard `root` voor MySQL en `postgres` voor PostgreSQL.     |
| `--password`    | Het wachtwoord; gebruik liever `GONESTLY_DB_PASSWORD` of de prompt. `--password=` is geen.       |
| `--name`        | De naam van de database, of het bestand van een SQLite-database.                                 |
| `--skip-create` | Verbind alleen het project, voor een database die al bestaat of op een andere manier is gemaakt. |

Een project dat al een database heeft blijft met rust: pas `DATABASE_URL` in `.env` aan om een andere te gebruiken. Het commando verwacht de opzet van `gonestly new`; voor een andere opzet voeg je de [module](database#verbinden) zelf toe.

## Routes en OpenAPI

`gonestly routes` en `gonestly openapi` lezen de routes en het document uit je applicatie zelf, zodat ze altijd kloppen met wat hij serveert:

```sh
gonestly routes
gonestly openapi -o openapi.json
```

```text
METHOD   PATH             CONTROLLER
GET      /health/live     health.NewController in module "health"
GET      /health/ready    health.NewController in module "health"
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
