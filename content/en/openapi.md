---
title: OpenAPI
description: Every route is described in an OpenAPI 3.1 document, generated from your types and tags, and served with Swagger UI.
---

Gonestly describes every route of your application in an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) document, without annotations. Like FastAPI, the documentation follows from the code: the handler's request and response types, their struct tags and the guards that protect the route. Because it is generated, it is always up to date.

Start an application with a controller and open:

| Path            | What it serves                                                        |
| --------------- | --------------------------------------------------------------------- |
| `/docs`         | Swagger UI, to read the API and try it out.                           |
| `/openapi.json` | The OpenAPI document, for client generators, Postman or API gateways. |

## What is derived

| Source                               | In the document                                                           |
| ------------------------------------ | ------------------------------------------------------------------------- |
| The route                            | Path, method, success status (201 for POST, 204 for an `Empty` response). |
| `path`, `query` and `header` tags    | Parameters with their types; path values are required.                    |
| The other fields of the request      | The JSON request body.                                                    |
| The response type                    | The JSON response, shared as a component per named type.                  |
| `json` tags                          | Property names, and which properties are optional.                        |
| `validate` tags                      | Required fields, lengths, ranges, enums and formats such as `email`.      |
| `doc` and `example` tags             | Descriptions and examples.                                                |
| Guards that implement `SecuredGuard` | Security schemes, the Authorize button and a 401 response.                |
| The handler's name                   | The operation ID and the summary, so `FindOne` becomes "Find one".        |
| The module                           | The tag that groups the route.                                            |

Every operation also documents its errors as [problem details](exception-handling): a 400 response when it has input, and a default error response.

## Describing fields

Add `doc` and `example` tags to the fields of your requests and responses:

```go
type CreateUserRequest struct {
	Name  string `json:"name" validate:"required,max=100" doc:"The full name." example:"Ada Lovelace"`
	Email string `json:"email" validate:"required,email" doc:"Where the invite is sent."`
	Role  string `json:"role,omitempty" validate:"omitempty,oneof=admin member"`
}
```

This produces a schema with a description, an example, a maximum length, the `email` format and an enum for `role`. A field is required unless it is a pointer, has `omitempty` or `omitzero`, or its `validate` tag starts with `omitempty`; `validate:"required"` always makes it required.

## Describing routes

Route options add text that cannot come from the code:

```go
gonestly.Post(r, "/", c.Create,
	gonestly.Summary("Create a user"),
	gonestly.Description("Creates the user and sends an invite to their email address."),
)
gonestly.Delete(r, "/{id}", c.Remove, gonestly.Deprecated())
gonestly.Get(r, "/export", c.Export, gonestly.Tags("reports"), gonestly.OperationID("exportUsers"))
```

| Option        | Default                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `Summary`     | The handler's name in words.                                                 |
| `Description` | None; Markdown works.                                                        |
| `Tags`        | The name of the route's module.                                              |
| `OperationID` | The handler's name, with the tag as a prefix when two handlers share a name. |
| `Deprecated`  | Not deprecated.                                                              |

## Authentication

A guard that implements `gonestly.SecuredGuard` tells the document how clients authenticate. Every route it protects gets the scheme, and Swagger UI shows an Authorize button:

```go
func (g *Guard) SecurityScheme() (string, gonestly.SecurityScheme) {
	return "bearer", gonestly.SecurityScheme{Type: "http", Scheme: "bearer", BearerFormat: "JWT"}
}
```

An API key works the same way, with `Type: "apiKey"`, `In: "header"` and `Name: "X-API-Key"`. Routes without a secured guard are marked as public. See [guards](guards).

## Configuration

Provide a `gonestly.OpenAPIConfig` in the root module:

```go
gonestly.Providers(gonestly.Value(gonestly.OpenAPIConfig{
	Title:       "Shop API",
	Version:     "1.4.0",
	Description: "Products, orders and customers.",
	Servers:     []string{"https://api.example.com"},
	Tags:        map[string]string{"users": "Accounts and their roles."},
}))
```

| Field              | Default             | Purpose                                    |
| ------------------ | ------------------- | ------------------------------------------ |
| `Title`, `Version` | `API`, `0.0.0`      | Shown at the top of the documentation.     |
| `Description`      | none                | An introduction; Markdown works.           |
| `Servers`          | the current address | The base URLs of the API.                  |
| `Tags`             | none                | Descriptions of the groups of routes.      |
| `JSONPath`         | `/openapi.json`     | Where the document is served.              |
| `DocsPath`         | `/docs`             | Where Swagger UI is served.                |
| `Disabled`         | `false`             | Stops serving the document and Swagger UI. |

To hide the documentation in production, set `Disabled` from your [configuration](configuration). Swagger UI is loaded from a CDN at a fixed version, checked with subresource integrity, and finds the document relative to its own address, so it also works behind a path prefix.

## Custom types

Types with their own JSON encoding describe themselves by implementing `gonestly.JSONSchemer`:

```go
func (Money) JSONSchema() *gonestly.Schema {
	return &gonestly.Schema{Type: "string", Description: "An amount such as 12.50."}
}
```

Types that implement `encoding.TextMarshaler`, such as `uuid.UUID` or `netip.Addr`, are documented as strings, `time.Time` as a date-time and `[]byte` as base64.

## Using the document

`gonestly openapi -o openapi.json` writes the document from the command line; see the [CLI](cli#routes-and-openapi).

`app.OpenAPI()` returns the document as JSON, also when serving is disabled. Write it to a file in CI to generate clients or to check for breaking changes:

```go
if err := os.WriteFile("openapi.json", app.OpenAPI(), 0o644); err != nil {
	log.Fatal(err)
}
```
