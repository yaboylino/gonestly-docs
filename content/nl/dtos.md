---
title: Request- en response-DTO's
description: Gebruik Go-structs om requests te koppelen en valideren, en bepaal welke JSON Gonestly terugstuurt.
---

Een DTO is een Go-struct die beschrijft welke gegevens via HTTP binnenkomen of naar buiten gaan. Een **request-DTO** bepaalt wat een endpoint accepteert. Een **response-DTO** bepaalt wat het terugstuurt. Gonestly leidt beide types af uit de handler. Je hoeft ze dus niet apart te registreren of een frameworktype toe te voegen.

## Definieer invoer en uitvoer

Zet API-types in `dto/` binnen de feature. Dit voorbeeld gebruikt `shop` als modulepad uit `go.mod`. Vervang het door je eigen modulepad.

```go title="internal/users/dto/create_user.go"
package dto

type CreateUserRequest struct {
	Name   string `json:"name" validate:"required,max=100"`
	Locale string `json:"locale" validate:"required,oneof=en nl"`
}
```

```go title="internal/users/dto/user_response.go"
package dto

type UserResponse struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Locale string `json:"locale"`
}
```

## Gebruik getypeerde constanten voor vaste waarden

De applicatie in dit voorbeeld ondersteunt alleen Engels en Nederlands. Definieer een eigen type `Locale` met getypeerde constanten in het package `users`. De DTO houdt de taalcode als string en hoeft daardoor `users` niet te importeren. De `oneof`-regel weigert onbekende waarden voordat de handler de string omzet naar `Locale`.

```go title="internal/users/locale.go"
package users

type Locale string

const (
	LocaleEN Locale = "en"
	LocaleNL Locale = "nl"
)
```

## Koppel de DTO's aan de route

Voeg deze methods toe aan je [controller](controllers). De bestaande service in dit voorbeeld neemt een naam en taalcode aan en geeft het opgeslagen gebruikersmodel terug.

```go title="internal/users/controller.go"
package users

import (
	"context"

	"github.com/yaboylino/gonestly"

	"shop/internal/users/dto"
)

func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/users")
	gonestly.Post(r, "/", c.Create)
}

func (c *Controller) Create(ctx context.Context, req dto.CreateUserRequest) (dto.UserResponse, error) {
	user, err := c.users.Create(ctx, req.Name, Locale(req.Locale))
	if err != nil {
		return dto.UserResponse{}, err
	}
	return dto.UserResponse{ID: user.ID, Name: user.Name, Locale: string(user.Locale)}, nil
}
```

Bij `POST /users` met `{"name":"Sam","locale":"nl"}` leest Gonestly de JSON in `CreateUserRequest`, valideert de invoer, roept `Create` aan en geeft de response-DTO terug als JSON met HTTP 201. Het databasemodel kan interne velden bevatten, zoals `InternalNotes`. Die komen niet in het antwoord terecht, omdat de handler alleen de publieke velden overneemt.

Voor `validate`-tags heb je de [validatormodule](validation) nodig. Als die geïnstalleerd en geregistreerd is, geeft `{"name":"Sam","locale":"fr"}` HTTP 400 voordat de handler draait.

Hetzelfde patroon werkt voor andere invoer. Met `path:"id"` lees je bijvoorbeeld `{id}` uit de route en met `query:"page"` lees je `?page=2`. Zie [controllers](controllers) en [projectstructuur](project-structure).
