---
title: Request and response DTOs
description: Use Go structs to bind and validate a request and control the JSON Gonestly returns.
---

A DTO is a Go struct that describes what crosses the HTTP boundary. A **request DTO** says what the endpoint accepts. A **response DTO** says what the endpoint sends back. Gonestly infers both types from the handler signature, so you do not register them separately or embed a framework type.

## Define the input and output

Put API types in `dto/` inside the feature. This example uses `shop` as the module path from `go.mod`. Replace it with your own module path.

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

## Use an enum for a fixed set

The application in this example supports only English and Dutch. In Go, represent that set with a named type and constants. The constants give your code consistent names; the `oneof` rule on the request DTO rejects other values.

```go title="internal/users/enums/locale.go"
package enums

type Locale string

const (
	LocaleEN Locale = "en"
	LocaleNL Locale = "nl"
)
```

## Connect the DTOs to the route

Add these methods to your [controller](controllers). The existing service in this example takes a name and locale and returns a saved user model.

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

For `POST /users` with `{"name":"Sam","locale":"nl"}`, Gonestly decodes the JSON into `CreateUserRequest`, validates it, calls `Create`, and returns the response DTO as JSON with HTTP 201. The database model can contain internal fields such as `InternalNotes`; they do not appear in the response because the handler maps only the public fields.

The `validate` tags require the [validator module](validation#struct-tags) to be installed and registered. With it enabled, `{"name":"Sam","locale":"fr"}` returns HTTP 400 before the handler runs.

Use the same pattern for other inputs. For example, `path:"id"` binds `{id}` from a route, and `query:"page"` binds `?page=2`. See [request binding](controllers#binding-requests) and [project structure](project-structure).
