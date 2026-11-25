---
title: Validatie
description: Valideer requests met een Validate-methode, of met struct-tags via de validatormodule.
---

Nadat een request is [gebonden](controllers#requests-binden), valideert Gonestly het voordat de handler draait. Je kunt de regels op twee manieren beschrijven, en ze combineren: met een `Validate`-methode op het requesttype, zonder dependencies, en met struct-tags via de module `validator`.

Ongeldige requests bereiken de handler nooit. De client krijgt een 400-response met alle ongeldige velden:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/users",
  "errors": [
    { "field": "name", "in": "body", "message": "is required" },
    { "field": "page", "in": "query", "message": "must be at least 1" }
  ]
}
```

## Een Validate-methode

Een requesttype met een methode `Validate() error` controleert zichzelf. Geef `gonestly.Invalid` terug met de ongeldige velden:

```go title="users/requests.go"
type CreateUserRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

func (r CreateUserRequest) Validate() error {
	var errs []gonestly.FieldError
	if strings.TrimSpace(r.Name) == "" {
		errs = append(errs, gonestly.FieldError{Field: "name", In: "body", Message: "is required"})
	}
	if !strings.Contains(r.Email, "@") {
		errs = append(errs, gonestly.FieldError{Field: "email", In: "body", Message: "must be a valid email address"})
	}
	if len(errs) > 0 {
		return gonestly.Invalid(errs...)
	}
	return nil
}
```

De methode mag een value- of pointerreceiver hebben. Elke andere fout wordt een 400-response met de foutmelding als detail, en een `*HTTPError` wordt verstuurd zoals hij is.

> [!HINT]
> Een `Validate`-methode is gewone code: gebruik hem voor regels over meerdere velden, zoals een einddatum na een begindatum.

## Struct-tags

De module `validator` controleert `validate`-tags met [go-playground/validator](https://github.com/go-playground/validator), het meest gebruikte validatiepackage voor Go. Hij staat in een eigen Go-module, zodat het framework zelf vrij van dependencies blijft:

```sh
go get github.com/yaboylino/gonestly/validator
```

Importeer zijn module één keer, in de rootmodule, en elke route valideert zijn request:

```go title="main.go"
var AppModule = &gonestly.Module{
	Name:    "app",
	Imports: gonestly.Imports(validator.Module(), users.Module),
}
```

```go
type CreateUserRequest struct {
	Name  string   `json:"name" validate:"required,max=100"`
	Email string   `json:"email" validate:"required,email"`
	Role  string   `json:"role" validate:"oneof=admin member"`
	Tags  []string `json:"tags" validate:"max=10"`
	Page  int      `query:"page" validate:"gte=1"`
}
```

Elk veld wordt gemeld met de naam die de client gebruikte, zijn JSON-naam, queryparameter, padwaarde of header, samen met de plek waar het vandaan kwam. Geneste velden krijgen een pad zoals `address.city`.

### Meldingen

Veelgebruikte regels krijgen een leesbare melding. De meldingen zijn in het Engels, net als de rest van de responses:

| Regel                    | Melding                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `required`               | is required                                                                         |
| `email`                  | must be a valid email address                                                       |
| `url`, `uuid`            | must be a valid URL, must be a valid UUID                                           |
| `oneof=a b`              | must be one of: a, b                                                                |
| `min`, `max`, `len`      | minimaal, maximaal of precies N tekens (strings), N items (lijsten) of N (getallen) |
| `gt`, `gte`, `lt`, `lte` | meer dan, minimaal, minder dan of maximaal N                                        |

Andere regels worden gemeld als `must satisfy <regel>`.

### Eigen regels

Geef functies mee aan `validator.Module` om eigen regels te registreren:

```go
validator.Module(func(v *playground.Validate) error {
	return v.RegisterValidation("slug", func(fl playground.FieldLevel) bool {
		return slugPattern.MatchString(fl.Field().String())
	})
})
```

Hier is `playground` de importnaam voor `github.com/go-playground/validator/v10`.

## Een eigen validator

De module `validator` levert een `gonestly.StructValidator`. Wil je een andere validatiebibliotheek gebruiken, lever dan je eigen implementatie in de rootmodule:

```go
type StructValidator interface {
	ValidateStruct(v any) error
}
```

## Volgorde

Gonestly bindt eerst het request, draait dan de structvalidator en ten slotte de `Validate`-methode, maar die alleen als de structvalidator niets vond. Requests die een slice of map zijn, worden niet door de module `validator` gecontroleerd.
