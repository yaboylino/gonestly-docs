---
title: Controllers
description: Controllers handle HTTP requests with typed handlers that receive a bound request and return a response encoded as JSON.
---

A controller groups the routes of one feature. Each route has a **handler**: a plain function that receives a typed request and returns a typed response. Gonestly binds the request from the URL, the headers and the body, validates it, calls the handler and sends the result as JSON.

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

A controller is any type with a `Routes(r *gonestly.Router)` method. Register it in the `Controllers` field of its module:

```go title="users/module.go"
var Module = &gonestly.Module{
	Name:        "users",
	Providers:   gonestly.Providers(NewService),
	Controllers: gonestly.Controllers(NewController),
}
```

Controllers are constructed like providers and can inject everything their module can. They cannot be injected into other providers or exported. As soon as an application has a controller, it starts an [HTTP server](http-server).

## Handlers

Every handler has the same shape:

```go
func(ctx context.Context, req Request) (Response, error)
```

The request and response types are yours. Register the handler with the function for its HTTP method:

| Function          | Method                       | Default status |
| ----------------- | ---------------------------- | -------------- |
| `gonestly.Get`    | GET, and HEAD without a body | 200            |
| `gonestly.Post`   | POST                         | 201            |
| `gonestly.Put`    | PUT                          | 200            |
| `gonestly.Patch`  | PATCH                        | 200            |
| `gonestly.Delete` | DELETE                       | 200            |

Change the status of a route with an option:

```go
gonestly.Post(r, "/{id}/archive", c.Archive, gonestly.Status(http.StatusAccepted))
```

A handler without input takes `gonestly.Empty` as its request. A handler that returns `gonestly.Empty` answers with **204 No Content** and no body:

```go
func (c *Controller) List(ctx context.Context, _ gonestly.Empty) ([]User, error)
func (c *Controller) Remove(ctx context.Context, req FindOneRequest) (gonestly.Empty, error)
```

## Paths

`Prefix` adds a prefix to the routes registered after it, and paths are joined with single slashes. `/` under the prefix `/users` is exactly `/users`, and a path never matches the paths below it unless you ask for it.

Path values are written as `{name}`. A final `{name...}` matches the rest of the path, such as `/files/{path...}`. Routes use the pattern syntax of `net/http`, so the most specific route wins.

## Binding requests

The request type describes where each value comes from. Tagged fields are read from the URL or the headers; the other exported fields are read from the JSON body:

```go
type UpdateUserRequest struct {
	ID      string   `path:"id"`        // /users/{id}
	Notify  bool     `query:"notify"`   // ?notify=true
	Tags    []string `query:"tag"`      // ?tag=a&tag=b
	Tenant  string   `header:"X-Tenant"`
	Name    string   `json:"name"`      // from the JSON body
	Email   string   `json:"email"`
}
```

| Source | Tag                    | Notes                                                                       |
| ------ | ---------------------- | --------------------------------------------------------------------------- |
| Path   | `path:"id"`            | The route must contain `{id}`; this is checked when the application starts. |
| Query  | `query:"page"`         | A slice collects repeated parameters.                                       |
| Header | `header:"X-Tenant"`    | A slice collects repeated headers.                                          |
| Body   | none, or `json:"name"` | Decoded with `encoding/json`.                                               |

Path, query and header fields support strings, booleans, numbers, `time.Duration`, slices and every type that implements `encoding.TextUnmarshaler`, such as `time.Time` or `uuid.UUID`. A value that comes from the URL or the headers always wins: a client cannot set a path value through the body.

A request type can also be a slice or a map, which is decoded from the whole body:

```go
func (c *Controller) Import(ctx context.Context, users []NewUser) (ImportResult, error)
```

### Invalid input

Input that cannot be bound never reaches the handler. The client receives a 400 response with every invalid field:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/users",
  "errors": [{ "field": "page", "in": "query", "message": "\"two\" is not a valid int" }]
}
```

A body that is not JSON gets **415 Unsupported Media Type**, invalid JSON gets **400**, and a body above the [size limit](http-server#configuration) gets **413**. Rules for the content of the fields belong in [validation](validation).

## Responses

The response is encoded as JSON with `Content-Type: application/json`. Errors are rendered as problem details; see [exception handling](exception-handling).

To set a response header, use `gonestly.ResponseHeader`; `gonestly.Request` returns the underlying `*http.Request`:

```go
func (c *Controller) Download(ctx context.Context, req FindOneRequest) (*Report, error) {
	gonestly.ResponseHeader(ctx).Set("Cache-Control", "max-age=60")
	userAgent := gonestly.Request(ctx).UserAgent()
	// ...
}
```

For responses that are not JSON, such as files or streams, register a plain `http.Handler` with `gonestly.Handle`. [Guards](guards) and [middleware](middleware) apply to it; binding, validation and interceptors do not:

```go
gonestly.Handle(r, http.MethodGet, "/{id}/avatar", http.HandlerFunc(c.Avatar))
```

## Groups

`Group` registers routes under an extra prefix. Guards, interceptors and middleware added inside the group only apply to its routes:

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

## Checked at startup

Routes are registered when the application starts, and every problem is reported before the server listens:

```text
invalid route: GET /users/{userId} in users.NewController in module "users": FindOneRequest.ID reads the path value "id", but the path /users/{userId} has no {id} wildcard
```

The same check catches unsupported field types, conflicting routes and handlers that are nil. See [error messages](error-messages#invalid-routes).
