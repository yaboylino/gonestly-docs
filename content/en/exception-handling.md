---
title: Exception handling
description: Return HTTP errors from handlers, guards and interceptors, and send every error to clients as problem details.
---

Handlers return errors like any Go function. Gonestly turns each error into a response in the format of [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457), problem details, so every error your API returns has the same shape:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "user 42 does not exist",
  "instance": "/users/42"
}
```

The response has the content type `application/problem+json`.

## HTTP errors

Return a `*gonestly.HTTPError` to choose the status and the message. The helpers take a format string, like `fmt.Errorf`:

```go
func (c *Controller) FindOne(ctx context.Context, req FindOneRequest) (*User, error) {
	user, err := c.users.FindByID(ctx, req.ID)
	if errors.Is(err, ErrUserNotFound) {
		return nil, gonestly.NotFound("user %s does not exist", req.ID)
	}
	return user, err
}
```

| Helper                              | Status     |
| ----------------------------------- | ---------- |
| `gonestly.BadRequest`               | 400        |
| `gonestly.Unauthorized`             | 401        |
| `gonestly.Forbidden`                | 403        |
| `gonestly.NotFound`                 | 404        |
| `gonestly.Conflict`                 | 409        |
| `gonestly.UnprocessableEntity`      | 422        |
| `gonestly.TooManyRequests`          | 429        |
| `gonestly.StatusError(status, ...)` | any status |

The detail message is sent to the client. Add the underlying error with `WithCause`: it is available to `errors.Is` and logs, but never sent:

```go
return nil, gonestly.Conflict("the email address is already in use").WithCause(err)
```

You can also build an `HTTPError` yourself to set a custom `Title`.

## Unexpected errors

Any other error becomes a **500 Internal Server Error** with a generic message. The real error is logged with the method, path and status, and never sent to the client, so a database error cannot leak connection details:

```json
{
  "type": "about:blank",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred.",
  "instance": "/users/42"
}
```

A panic in a handler is recovered, logged with its stack trace and answered the same way.

## Validation errors

`gonestly.Invalid` returns a 400 error that lists the invalid fields; binding and [validation](validation) use it:

```go
return gonestly.Invalid(
	gonestly.FieldError{Field: "email", In: "body", Message: "must be a valid email address"},
)
```

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/users",
  "errors": [{ "field": "email", "in": "body", "message": "must be a valid email address" }]
}
```

## Unknown routes

Requests that match no route get a 404, and requests with a method the route does not support get a 405 with an `Allow` header, both as problem details.

## Mapping domain errors

To translate errors of your domain in one place, use an [interceptor](interceptors). This one turns `sql.ErrNoRows` into a 404 for every route it wraps:

```go
var NotFoundOnNoRows = gonestly.InterceptorFunc(func(ctx context.Context, r *http.Request, next gonestly.Next) (any, error) {
	result, err := next(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, gonestly.NotFound("%s does not exist", r.URL.Path).WithCause(err)
	}
	return result, err
})
```

## Decoding errors on the client

Clients written in Go, and tests, can decode the body into `gonestly.Problem`. In tests, `Response.Problem` from [gonestlytest](testing) does it for you.
