---
title: Guards
description: Guards decide whether a request may reach its handler, for authentication, authorization and rate limits.
---

A guard runs before a route's handler and decides whether the request may continue. It is the place for authentication, roles and permissions, feature flags and rate limits.

```go
type Guard interface {
	Check(ctx context.Context, r *http.Request) (context.Context, error)
}
```

To reject a request, return an error, usually an `*HTTPError` such as `gonestly.Unauthorized`. To let it through, return a context: the same one, or one that carries extra values such as the authenticated user.

## A guard as a provider

Guards usually need dependencies, such as a service that verifies tokens. Make the guard a provider and inject it into the controllers that use it:

```go title="auth/guard.go"
type Guard struct {
	tokens *TokenService
}

func NewGuard(tokens *TokenService) *Guard {
	return &Guard{tokens: tokens}
}

func (g *Guard) Check(ctx context.Context, r *http.Request) (context.Context, error) {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return nil, gonestly.Unauthorized("a bearer token is required")
	}
	user, err := g.tokens.Verify(ctx, token)
	if err != nil {
		return nil, gonestly.Unauthorized("the token is invalid").WithCause(err)
	}
	return WithUser(ctx, user), nil
}
```

```go title="users/controller.go"
func NewController(users *Service, auth *auth.Guard) *Controller {
	return &Controller{users: users, auth: auth}
}

func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/users").Guard(c.auth)
	gonestly.Get(r, "/me", c.Me)
}
```

## Passing values to the handler

Store values in the context with an unexported key type, and offer a function to read them back:

```go title="auth/user.go"
type userKey struct{}

func WithUser(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, userKey{}, user)
}

func UserFrom(ctx context.Context) *User {
	user, _ := ctx.Value(userKey{}).(*User)
	return user
}
```

```go
func (c *Controller) Me(ctx context.Context, _ gonestly.Empty) (*User, error) {
	return auth.UserFrom(ctx), nil
}
```

## Small guards

For a guard without dependencies, `gonestly.GuardFunc` turns a function into a guard:

```go
var AdminOnly = gonestly.GuardFunc(func(ctx context.Context, r *http.Request) (context.Context, error) {
	if !auth.UserFrom(ctx).IsAdmin {
		return nil, gonestly.Forbidden("this action requires the admin role")
	}
	return ctx, nil
})
```

## In the API documentation

A guard that implements `gonestly.SecuredGuard` tells the [OpenAPI](openapi) document how clients authenticate. Every route it protects gets the scheme and a 401 response, and Swagger UI shows an Authorize button:

```go
func (g *Guard) SecurityScheme() (string, gonestly.SecurityScheme) {
	return "bearer", gonestly.SecurityScheme{Type: "http", Scheme: "bearer", BearerFormat: "JWT"}
}
```

## Ready-made authentication

For JSON Web Tokens you do not have to write the guard yourself: the [jwt module](authentication) has one that verifies the token, puts the caller in the context and can require a role.

## Where guards apply

| Scope                          | How                                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| Every route of the application | `Guards` in the [server configuration](http-server#configuration) |
| The routes registered after it | `r.Guard(...)`                                                    |
| The routes of a group          | `r.Guard(...)` inside `r.Group`                                   |
| One route                      | the option `gonestly.WithGuards(...)`                             |

Guards run in that order: global guards first, then those of the router, then those of the route. The first guard that returns an error stops the request. Guards run before the request is bound, so an unauthorized client never learns whether its input was valid, and they also apply to routes registered with `gonestly.Handle`.
