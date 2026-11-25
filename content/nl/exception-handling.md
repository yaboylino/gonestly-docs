---
title: Foutafhandeling
description: Geef HTTP-fouten terug vanuit handlers, guards en interceptors, en stuur elke fout als problem details naar de client.
---

Handlers geven fouten terug zoals elke Go-functie. Gonestly maakt van elke fout een response in het formaat van [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457), problem details, zodat elke fout van je API dezelfde vorm heeft:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "user 42 does not exist",
  "instance": "/users/42"
}
```

Het response heeft het contenttype `application/problem+json`.

## HTTP-fouten

Geef een `*gonestly.HTTPError` terug om de status en de melding te kiezen. De hulpfuncties nemen een formatstring, net als `fmt.Errorf`:

```go
func (c *Controller) FindOne(ctx context.Context, req FindOneRequest) (*User, error) {
	user, err := c.users.FindByID(ctx, req.ID)
	if errors.Is(err, ErrUserNotFound) {
		return nil, gonestly.NotFound("user %s does not exist", req.ID)
	}
	return user, err
}
```

| Hulpfunctie                         | Status      |
| ----------------------------------- | ----------- |
| `gonestly.BadRequest`               | 400         |
| `gonestly.Unauthorized`             | 401         |
| `gonestly.Forbidden`                | 403         |
| `gonestly.NotFound`                 | 404         |
| `gonestly.Conflict`                 | 409         |
| `gonestly.UnprocessableEntity`      | 422         |
| `gonestly.TooManyRequests`          | 429         |
| `gonestly.StatusError(status, ...)` | elke status |

De melding gaat naar de client. Voeg de onderliggende fout toe met `WithCause`: die is beschikbaar voor `errors.Is` en voor logs, maar wordt nooit verstuurd:

```go
return nil, gonestly.Conflict("the email address is already in use").WithCause(err)
```

Je kunt een `HTTPError` ook zelf opbouwen om een eigen `Title` te zetten.

## Onverwachte fouten

Elke andere fout wordt een **500 Internal Server Error** met een algemene melding. De echte fout wordt gelogd met methode, pad en status, en nooit naar de client gestuurd, zodat een databasefout geen verbindingsgegevens kan lekken:

```json
{
  "type": "about:blank",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred.",
  "instance": "/users/42"
}
```

Een panic in een handler wordt opgevangen, met stacktrace gelogd en op dezelfde manier beantwoord.

## Validatiefouten

`gonestly.Invalid` geeft een 400-fout met een lijst ongeldige velden; binding en [validatie](validation) gebruiken hem:

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

## Onbekende routes

Requests die bij geen enkele route passen, krijgen een 404, en requests met een methode die de route niet ondersteunt een 405 met een `Allow`-header, allebei als problem details.

## Domeinfouten vertalen

Om fouten uit je domein op één plek te vertalen, gebruik je een [interceptor](interceptors). Deze maakt van `sql.ErrNoRows` een 404 voor elke route die hij omsluit:

```go
var NotFoundOnNoRows = gonestly.InterceptorFunc(func(ctx context.Context, r *http.Request, next gonestly.Next) (any, error) {
	result, err := next(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, gonestly.NotFound("%s does not exist", r.URL.Path).WithCause(err)
	}
	return result, err
})
```

## Fouten lezen in de client

Clients in Go, en tests, kunnen de body inlezen in `gonestly.Problem`. In tests doet `Response.Problem` uit [gonestlytest](testing) dat voor je.
