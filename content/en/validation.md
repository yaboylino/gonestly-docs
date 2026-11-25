---
title: Validation
description: Validate requests with a Validate method, or with struct tags through the validator module.
---

After a request is [bound](controllers#binding-requests), Gonestly validates it before the handler runs. There are two ways to describe the rules, and you can combine them: a `Validate` method on the request type, which needs no dependencies, and struct tags through the `validator` module.

Invalid requests never reach the handler. The client receives a 400 response that lists every invalid field:

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

## A Validate method

A request type with a `Validate() error` method checks itself. Return `gonestly.Invalid` with the invalid fields:

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

The method can have a value or a pointer receiver. Any other error becomes a 400 response with the error message as its detail, and an `*HTTPError` is sent as it is.

> [!HINT]
> A `Validate` method is ordinary code: use it for rules that span several fields, such as an end date after a start date.

## Struct tags

The `validator` module checks `validate` tags with [go-playground/validator](https://github.com/go-playground/validator), the most widely used validation package for Go. It lives in its own Go module, so the framework itself stays free of dependencies:

```sh
go get github.com/yaboylino/gonestly/validator
```

Import its module once, in the root module, and every route validates its request:

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

Every field is reported by the name the client used, its JSON name, query parameter, path value or header, together with where it was read from. Nested fields get a path such as `address.city`.

### Messages

Common rules get a readable message:

| Rule                     | Message                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `required`               | is required                                                                                      |
| `email`                  | must be a valid email address                                                                    |
| `url`, `uuid`            | must be a valid URL, must be a valid UUID                                                        |
| `oneof=a b`              | must be one of: a, b                                                                             |
| `min`, `max`, `len`      | must be at least, at most or exactly N characters long (strings), N items (lists) or N (numbers) |
| `gt`, `gte`, `lt`, `lte` | must be more than, at least, less than or at most N                                              |

Other rules are reported as `must satisfy <rule>`.

### Custom rules

Pass functions to `validator.Module` to register your own rules:

```go
validator.Module(func(v *playground.Validate) error {
	return v.RegisterValidation("slug", func(fl playground.FieldLevel) bool {
		return slugPattern.MatchString(fl.Field().String())
	})
})
```

Here `playground` is the import name for `github.com/go-playground/validator/v10`.

## Your own validator

The `validator` module provides a `gonestly.StructValidator`. To use another validation library, provide your own implementation in the root module:

```go
type StructValidator interface {
	ValidateStruct(v any) error
}
```

## Order

Gonestly first binds the request, then runs the struct validator and finally the `Validate` method, but only when the struct validator found nothing. Requests that are slices or maps are not checked by the `validator` module.
