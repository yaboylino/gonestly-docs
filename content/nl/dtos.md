---
title: Request- en response-DTO's
description: Gebruik Go-structs om requests te koppelen en valideren, en bepaal welke JSON Gonestly terugstuurt.
---

Een DTO is een Go-struct die beschrijft welke gegevens via HTTP binnenkomen of naar buiten gaan. Een **request-DTO** bepaalt wat een endpoint accepteert. Een **response-DTO** bepaalt wat het terugstuurt. Gonestly leidt beide types af uit de handler. Je hoeft ze dus niet apart te registreren of een frameworktype toe te voegen.

## Definieer invoer en uitvoer

Zet API-types in `dto/` binnen de feature. Dit voorbeeld gebruikt `shop` als modulepad uit `go.mod`. Vervang het door je eigen modulepad.

```go title="internal/users/dto/create_user.go"
package dto

import "shop/internal/users/enums"

type CreateUserRequest struct {
	Name   string       `json:"name" validate:"required,max=100"`
	Locale enums.Locale `json:"locale" validate:"required,oneof=en nl"`
}
```

```go title="internal/users/dto/user_response.go"
package dto

import "shop/internal/users/enums"

type UserResponse struct {
	ID     int64        `json:"id"`
	Name   string       `json:"name"`
	Locale enums.Locale `json:"locale"`
}
```

## Gebruik een enum voor een vaste reeks waarden

De applicatie in dit voorbeeld ondersteunt alleen Engels en Nederlands. In Go leg je die reeks vast met een eigen type en constanten. De constanten geven je code vaste namen; de `oneof`-regel op de request-DTO weigert andere waarden.

```go title="internal/users/enums/locale.go"
package enums

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
	"shop/internal/users/dto"

	"github.com/yaboylino/gonestly"
)

func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/users")
	gonestly.Post(r, "/", c.Create)
}

func (c *Controller) Create(ctx context.Context, req dto.CreateUserRequest) (dto.UserResponse, error) {
	user, err := c.users.Create(ctx, req.Name, req.Locale)
	if err != nil {
		return dto.UserResponse{}, err
	}
	return dto.UserResponse{ID: user.ID, Name: user.Name, Locale: user.Locale}, nil
}
```

Bij `POST /users` met `{"name":"Sam","locale":"nl"}` leest Gonestly de JSON in `CreateUserRequest`, valideert de invoer, roept `Create` aan en geeft de response-DTO terug als JSON met HTTP 201. Het databasemodel kan interne velden bevatten, zoals `InternalNotes`. Die komen niet in het antwoord terecht, omdat de handler alleen de publieke velden overneemt.

Voor `validate`-tags heb je de [validatormodule](validation) nodig. Als die geïnstalleerd en geregistreerd is, geeft `{"name":"Sam","locale":"fr"}` HTTP 400 voordat de handler draait.

Hetzelfde patroon werkt voor andere invoer. Met `path:"id"` lees je bijvoorbeeld `{id}` uit de route en met `query:"page"` lees je `?page=2`. Zie [controllers](controllers) en [projectstructuur](project-structure).
