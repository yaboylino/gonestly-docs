---
title: Projectstructuur
description: Deel Gonestly-apps in per feature, met afspraken over DTO's, enums, controllers, services, tests en migraties.
---

Deel je applicatie in per feature. Zet producten in `internal/products` en bestellingen in `internal/orders`. Elke feature heeft zijn eigen routes, bedrijfslogica en API-types. Maak dus geen centrale mappen zoals `controllers/`, `services/`, `dto/` en `enums/` voor de hele applicatie.

## Aanbevolen mapindeling

```text
shop/
  main.go
  go.mod
  go.sum
  .env.example
  internal/
    app/
      module.go
      config.go
    health/
      module.go
      controller.go
      controller_test.go
    products/
      module.go
      controller.go
      controller_test.go
      service.go
      service_test.go
      model.go
      columns_gen.go
      dto/
        create_product.go
        update_product.go
        product_response.go
      enums/
        status.go
        status_test.go
  migrations/
    migrations.go
    20261126100000_create_products.up.sql
    20261126100000_create_products.down.sql
```

## Wat zet je waar?

| Plek                           | Verantwoordelijkheid                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `main.go`                      | Start de applicatie met de hoofdmodule. Zet hier geen bedrijfslogica.                                            |
| `internal/app/`                | Koppel features en infrastructuur aan elkaar. Bewaar hier de configuratie van de applicatie.                     |
| `module.go`                    | Registreer de controllers en providers van de feature. Exporteer alleen wat andere modules nodig hebben.         |
| `controller.go`                | Definieer routes, geef de invoer door aan de service en stuur het API-antwoord terug.                            |
| `service.go`                   | Plaats hier de bedrijfsregels en coördineer databasebewerkingen.                                                 |
| `model.go` en `columns_gen.go` | Houd het databasemodel en de gegenereerde getypeerde kolommen bij elkaar. Pas de gegenereerde kolommen niet aan. |
| `dto/`                         | Bewaar hier de types voor HTTP-verzoeken en -antwoorden, inclusief tags voor binding en validatie.               |
| `enums/`                       | Bewaar hier types met een vaste reeks waarden, zoals `Status` en zijn getypeerde constanten.                     |
| `*_test.go`                    | Zet tests naast de code die ze testen: routetests bij de controller en tests voor bedrijfsregels bij de service. |
| `migrations/`                  | Bewaar genummerde SQL-migraties in de hoofdmap van het project, los van de featurecode.                          |

## DTO's en enums

Bekijk [request- en response-DTO's](dtos) voor een voorbeeld van hoe Gonestly invoer koppelt, valideert en als JSON antwoordt.

Gebruik namen als `dto.CreateProductRequest`, `dto.UpdateProductRequest`, `dto.ProductResponse` en `enums.Status`. Met een response-DTO bepaal je welke velden je terugstuurt, zonder het databasemodel rechtstreeks te gebruiken. Een enum in Go is een benoemd type met constanten. Het type zelf houdt onbekende waarden niet tegen. Gebruik daarom [validatieregels](validation) voor waarden die via een HTTP-verzoek binnenkomen.

Laat imports één kant op lopen: `products` mag `products/dto` en `products/enums` importeren, en `dto` mag `enums` importeren. Geen van beide subpackages importeert `products`. Zet het omzetten van DTO naar model en terug in het package van de feature. Gebruik kleine letters zonder scheidingstekens voor packagenamen, zoals `orderitems` voor bestelregels.

```go title="internal/products/enums/status.go"
package enums

type Status string

const (
	StatusDraft  Status = "draft"
	StatusActive Status = "active"
)
```

```go title="internal/products/dto/create_product.go"
package dto

import "shop/internal/products/enums"

type CreateProductRequest struct {
	Name   string       `json:"name" validate:"required,max=200"`
	Status enums.Status `json:"status" validate:"required,oneof=draft active"`
}
```

## Begin met de CLI

De [resourcegenerator](generators) begint met een platte featuremap en zet requesttypes bij elkaar in `requests.go`. Als je de API-types opsplitst naar `dto/`, verplaats dan de definitie en pas de verwijzingen in de controller, service en tests aan. Voeg `enums/` alleen toe als de feature een vaste reeks waarden nodig heeft. Maak geen lege mappen aan.

Houd databasetoegang bij de feature. De gegenereerde service gebruikt de generieke [repository](repositories) van Gonestly. Voeg pas een eigen `repository.go` toe als je maatwerk voor databasetoegang apart wilt houden. Wil je functionaliteit tussen features delen? Importeer de andere [module](modules) en gebruik een provider die die module expliciet exporteert.

Zet guards en interceptors die bij één feature horen in die feature. Gebruiken meerdere features dezelfde authenticatieguard? Zet die bijvoorbeeld in `internal/auth` en exporteer hem vanuit die module.
