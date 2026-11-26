---
title: Controllers
description: Controllers handelen HTTP-requests af met getypeerde handlers die een gebonden request krijgen en een response als JSON teruggeven.
---

Een controller groepeert de routes van één onderdeel. Elke route heeft een **handler**: een gewone functie die een getypeerd request krijgt en een getypeerd response teruggeeft. Gonestly vult het request uit de URL, de headers en de body, valideert het, roept de handler aan en stuurt het resultaat als JSON terug.

```go title="users/controller.go"
type Controller struct {
	users *Service
}

func NewController(users *Service) *Controller {
	return &Controller{users: users}
}

func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/users")
	gonestly.Get(r, "/", c.List)
	gonestly.Get(r, "/{id}", c.FindOne)
	gonestly.Post(r, "/", c.Create)
}

func (c *Controller) FindOne(ctx context.Context, req FindOneRequest) (*User, error) {
	return c.users.FindByID(ctx, req.ID)
}
```

Een controller is elk type met een methode `Routes(r *gonestly.Router)`. Registreer hem in het veld `Controllers` van zijn module:

```go title="users/module.go"
var Module = &gonestly.Module{
	Name:        "users",
	Providers:   gonestly.Providers(NewService),
	Controllers: gonestly.Controllers(NewController),
}
```

Controllers worden net als providers gebouwd en kunnen alles injecteren wat hun module kan. Zelf kunnen ze niet in andere providers worden geïnjecteerd of geëxporteerd. Zodra een applicatie een controller heeft, start hij een [HTTP-server](http-server).

## Handlers

Bekijk [request- en response-DTO's](dtos) voor een compleet voorbeeld van `POST /users`.

Elke handler heeft dezelfde vorm:

```go
func(ctx context.Context, req Request) (Response, error)
```

De request- en responsetypes bepaal je zelf. Registreer de handler met de functie voor zijn HTTP-methode:

| Functie           | Methode                  | Standaardstatus |
| ----------------- | ------------------------ | --------------- |
| `gonestly.Get`    | GET, en HEAD zonder body | 200             |
| `gonestly.Post`   | POST                     | 201             |
| `gonestly.Put`    | PUT                      | 200             |
| `gonestly.Patch`  | PATCH                    | 200             |
| `gonestly.Delete` | DELETE                   | 200             |

Verander de status van een route met een optie:

```go
gonestly.Post(r, "/{id}/archive", c.Archive, gonestly.Status(http.StatusAccepted))
```

Een handler zonder invoer krijgt `gonestly.Empty` als request. Een handler die `gonestly.Empty` teruggeeft, antwoordt met **204 No Content** en zonder body:

```go
func (c *Controller) List(ctx context.Context, _ gonestly.Empty) ([]User, error)
func (c *Controller) Remove(ctx context.Context, req FindOneRequest) (gonestly.Empty, error)
```

## Paden

`Prefix` zet een prefix voor de routes die daarna worden geregistreerd, en paden worden met enkele slashes samengevoegd. `/` onder de prefix `/users` is precies `/users`, en een pad matcht nooit de paden eronder, tenzij je daarom vraagt.

Waarden uit het pad schrijf je als `{name}`. Een laatste `{name...}` matcht de rest van het pad, zoals `/files/{path...}`. Routes gebruiken de patroonsyntax van `net/http`, dus de meest specifieke route wint.

## Requests binden

Het requesttype beschrijft waar elke waarde vandaan komt. Velden met een tag komen uit de URL of de headers; de andere geëxporteerde velden komen uit de JSON-body:

```go
type UpdateUserRequest struct {
	ID      string   `path:"id"`        // /users/{id}
	Notify  bool     `query:"notify"`   // ?notify=true
	Tags    []string `query:"tag"`      // ?tag=a&tag=b
	Tenant  string   `header:"X-Tenant"`
	Name    string   `json:"name"`      // uit de JSON-body
	Email   string   `json:"email"`
}
```

| Bron   | Tag                    | Opmerking                                                               |
| ------ | ---------------------- | ----------------------------------------------------------------------- |
| Pad    | `path:"id"`            | De route moet `{id}` bevatten; dat wordt bij het starten gecontroleerd. |
| Query  | `query:"page"`         | Een slice verzamelt herhaalde parameters.                               |
| Header | `header:"X-Tenant"`    | Een slice verzamelt herhaalde headers.                                  |
| Body   | geen, of `json:"name"` | Gelezen met `encoding/json`.                                            |

Velden uit pad, query en headers ondersteunen strings, booleans, getallen, `time.Duration`, slices en elk type dat `encoding.TextUnmarshaler` implementeert, zoals `time.Time` of `uuid.UUID`. Gebruik een pointer, zoals `*int`, om een ontbrekende parameter te onderscheiden van de waarde nul: die blijft `nil` als de client hem niet meestuurt. Een waarde uit de URL of de headers wint altijd: een client kan een padwaarde niet via de body zetten.

Een requesttype kan ook een slice of een map zijn, die uit de hele body wordt gelezen:

```go
func (c *Controller) Import(ctx context.Context, users []NewUser) (ImportResult, error)
```

### Ongeldige invoer

Invoer die niet gebonden kan worden, bereikt de handler nooit. De client krijgt een 400-response met alle ongeldige velden:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/users",
  "errors": [{ "field": "page", "in": "query", "message": "\"two\" is not a whole number" }]
}
```

Een body die geen JSON is, krijgt **415 Unsupported Media Type**, ongeldige JSON krijgt **400**, en een body boven de [maximale grootte](http-server#configuratie) krijgt **413**. Regels voor de inhoud van velden horen bij [validatie](validation).

## Responses

Het response wordt als JSON verstuurd met `Content-Type: application/json`. Fouten worden als problem details verstuurd; zie [foutafhandeling](exception-handling).

Een responseheader zet je met `gonestly.ResponseHeader`; `gonestly.Request` geeft het onderliggende `*http.Request`:

```go
func (c *Controller) Download(ctx context.Context, req FindOneRequest) (*Report, error) {
	gonestly.ResponseHeader(ctx).Set("Cache-Control", "max-age=60")
	userAgent := gonestly.Request(ctx).UserAgent()
	// ...
}
```

Voor responses die geen JSON zijn, zoals bestanden of streams, registreer je een gewone `http.Handler` met `gonestly.Handle`. [Guards](guards) en [middleware](middleware) gelden daarvoor wel; binding, validatie en interceptors niet:

```go
gonestly.Handle(r, http.MethodGet, "/{id}/avatar", http.HandlerFunc(c.Avatar))
```

## Documentatie

Elke route verschijnt automatisch in het [OpenAPI](openapi)-document en in Swagger UI. Voeg een samenvatting, beschrijving of tags toe met route-opties zoals `gonestly.Summary`, en beschrijf velden met `doc`- en `example`-tags.

## Groepen

`Group` registreert routes onder een extra prefix. Guards, interceptors en middleware die je binnen de groep toevoegt, gelden alleen voor die routes:

```go
func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/users")
	gonestly.Get(r, "/{id}", c.FindOne)

	r.Group("/admin", func(r *gonestly.Router) {
		r.Guard(c.adminOnly)
		gonestly.Delete(r, "/{id}", c.Remove) // DELETE /users/admin/{id}
	})
}
```

## Gecontroleerd bij het starten

Routes worden geregistreerd als de applicatie start, en elk probleem wordt gemeld voordat de server luistert:

```text
invalid route: GET /users/{userId} in users.NewController in module "users": FindOneRequest.ID reads the path value "id", but the path /users/{userId} has no {id} wildcard
```

Dezelfde controle vangt niet-ondersteunde veldtypes, botsende routes en handlers die nil zijn af. Zie [foutmeldingen](error-messages#ongeldige-routes).
