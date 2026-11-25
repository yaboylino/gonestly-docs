---
title: OpenAPI
description: Elke route staat beschreven in een OpenAPI 3.1-document dat uit je types en tags wordt gegenereerd en met Swagger UI wordt geserveerd.
---

Gonestly beschrijft elke route van je applicatie in een [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0)-document, zonder annotaties. Net als bij FastAPI volgt de documentatie uit de code: de request- en responsetypes van de handler, hun struct-tags en de guards die de route beschermen. Omdat het document gegenereerd wordt, is het altijd actueel.

Start een applicatie met een controller en open:

| Pad             | Wat het serveert                                                      |
| --------------- | --------------------------------------------------------------------- |
| `/docs`         | Swagger UI, om de API te lezen en uit te proberen.                    |
| `/openapi.json` | Het OpenAPI-document, voor clientgenerators, Postman of API-gateways. |

## Wat er wordt afgeleid

| Bron                                    | In het document                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| De route                                | Pad, methode en successtatus (201 voor POST, 204 voor een `Empty`-response). |
| `path`-, `query`- en `header`-tags      | Parameters met hun types; padwaarden zijn verplicht.                         |
| De andere velden van het request        | De JSON-requestbody.                                                         |
| Het responsetype                        | Het JSON-response, gedeeld als component per type met een naam.              |
| `json`-tags                             | Namen van properties, en welke properties optioneel zijn.                    |
| `validate`-tags                         | Verplichte velden, lengtes, bereiken, enums en formaten zoals `email`.       |
| `doc`- en `example`-tags                | Beschrijvingen en voorbeelden.                                               |
| Guards die `SecuredGuard` implementeren | Security schemes, de Authorize-knop en een 401-response.                     |
| De naam van de handler                  | De operation-ID en de samenvatting, dus `FindOne` wordt "Find one".          |
| De module                               | De tag die de route groepeert.                                               |

Elke operatie documenteert ook zijn fouten als [problem details](exception-handling): een 400-response als hij invoer heeft, en een standaard foutresponse.

## Velden beschrijven

Voeg `doc`- en `example`-tags toe aan de velden van je requests en responses:

```go
type CreateUserRequest struct {
	Name  string `json:"name" validate:"required,max=100" doc:"The full name." example:"Ada Lovelace"`
	Email string `json:"email" validate:"required,email" doc:"Where the invite is sent."`
	Role  string `json:"role,omitempty" validate:"omitempty,oneof=admin member"`
}
```

Dit levert een schema op met een beschrijving, een voorbeeld, een maximale lengte, het formaat `email` en een enum voor `role`. Een veld is verplicht, tenzij het een pointer is, `omitempty` of `omitzero` heeft, of zijn `validate`-tag met `omitempty` begint; `validate:"required"` maakt het altijd verplicht.

## Routes beschrijven

Route-opties voegen tekst toe die niet uit de code kan komen:

```go
gonestly.Post(r, "/", c.Create,
	gonestly.Summary("Create a user"),
	gonestly.Description("Creates the user and sends an invite to their email address."),
)
gonestly.Delete(r, "/{id}", c.Remove, gonestly.Deprecated())
gonestly.Get(r, "/export", c.Export, gonestly.Tags("reports"), gonestly.OperationID("exportUsers"))
```

| Optie         | Standaard                                                                         |
| ------------- | --------------------------------------------------------------------------------- |
| `Summary`     | De naam van de handler in woorden.                                                |
| `Description` | Geen; Markdown werkt.                                                             |
| `Tags`        | De naam van de module van de route.                                               |
| `OperationID` | De naam van de handler, met de tag ervoor als twee handlers dezelfde naam hebben. |
| `Deprecated`  | Niet verouderd.                                                                   |

## Authenticatie

Een guard die `gonestly.SecuredGuard` implementeert, vertelt het document hoe clients inloggen. Elke route die hij beschermt, krijgt het schema, en Swagger UI toont een Authorize-knop:

```go
func (g *Guard) SecurityScheme() (string, gonestly.SecurityScheme) {
	return "bearer", gonestly.SecurityScheme{Type: "http", Scheme: "bearer", BearerFormat: "JWT"}
}
```

Een API-sleutel werkt hetzelfde, met `Type: "apiKey"`, `In: "header"` en `Name: "X-API-Key"`. Routes zonder beveiligde guard worden als openbaar gemarkeerd. Zie [guards](guards).

## Configuratie

Lever een `gonestly.OpenAPIConfig` in de rootmodule:

```go
gonestly.Providers(gonestly.Value(gonestly.OpenAPIConfig{
	Title:       "Shop API",
	Version:     "1.4.0",
	Description: "Products, orders and customers.",
	Servers:     []string{"https://api.example.com"},
	Tags:        map[string]string{"users": "Accounts and their roles."},
}))
```

| Veld               | Standaard         | Doel                                                   |
| ------------------ | ----------------- | ------------------------------------------------------ |
| `Title`, `Version` | `API`, `0.0.0`    | Bovenaan de documentatie.                              |
| `Description`      | geen              | Een introductie; Markdown werkt.                       |
| `Servers`          | het huidige adres | De basis-URL's van de API.                             |
| `Tags`             | geen              | Beschrijvingen van de groepen routes.                  |
| `JSONPath`         | `/openapi.json`   | Waar het document wordt geserveerd.                    |
| `DocsPath`         | `/docs`           | Waar Swagger UI wordt geserveerd.                      |
| `Disabled`         | `false`           | Stopt met het serveren van het document en Swagger UI. |

Wil je de documentatie in productie verbergen, zet `Disabled` dan vanuit je [configuratie](configuration). Swagger UI wordt van een CDN geladen in een vaste versie, gecontroleerd met subresource integrity, en vindt het document relatief aan zijn eigen adres, zodat het ook achter een padprefix werkt.

## Eigen types

Types met een eigen JSON-codering beschrijven zichzelf door `gonestly.JSONSchemer` te implementeren:

```go
func (Money) JSONSchema() *gonestly.Schema {
	return &gonestly.Schema{Type: "string", Description: "An amount such as 12.50."}
}
```

Types die `encoding.TextMarshaler` implementeren, zoals `uuid.UUID` of `netip.Addr`, worden als string gedocumenteerd, `time.Time` als date-time en `[]byte` als base64.

## Het document gebruiken

`app.OpenAPI()` geeft het document als JSON, ook als het serveren uit staat. Schrijf het in CI naar een bestand om clients te genereren of om op brekende wijzigingen te controleren:

```go
if err := os.WriteFile("openapi.json", app.OpenAPI(), 0o644); err != nil {
	log.Fatal(err)
}
```
