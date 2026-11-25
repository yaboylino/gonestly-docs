---
title: Guards
description: Guards bepalen of een request bij zijn handler mag komen, voor authenticatie, autorisatie en rate limits.
---

Een guard draait vóór de handler van een route en bepaalt of het request verder mag. Het is de plek voor authenticatie, rollen en rechten, feature flags en rate limits.

```go
type Guard interface {
	Check(ctx context.Context, r *http.Request) (context.Context, error)
}
```

Om een request te weigeren, geef je een fout terug, meestal een `*HTTPError` zoals `gonestly.Unauthorized`. Om het door te laten, geef je een context terug: dezelfde, of een die extra waarden meedraagt, zoals de ingelogde gebruiker.

## Een guard als provider

Guards hebben meestal afhankelijkheden, zoals een service die tokens controleert. Maak de guard een provider en injecteer hem in de controllers die hem gebruiken:

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

## Waarden doorgeven aan de handler

Bewaar waarden in de context met een niet-geëxporteerd sleuteltype, en bied een functie om ze terug te lezen:

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

## Kleine guards

Voor een guard zonder afhankelijkheden maakt `gonestly.GuardFunc` van een functie een guard:

```go
var AdminOnly = gonestly.GuardFunc(func(ctx context.Context, r *http.Request) (context.Context, error) {
	if !auth.UserFrom(ctx).IsAdmin {
		return nil, gonestly.Forbidden("this action requires the admin role")
	}
	return ctx, nil
})
```

## Waar guards gelden

| Bereik                                    | Hoe                                                           |
| ----------------------------------------- | ------------------------------------------------------------- |
| Elke route van de applicatie              | `Guards` in de [serverconfiguratie](http-server#configuratie) |
| De routes die daarna worden geregistreerd | `r.Guard(...)`                                                |
| De routes van een groep                   | `r.Guard(...)` binnen `r.Group`                               |
| Eén route                                 | de optie `gonestly.WithGuards(...)`                           |

Guards draaien in die volgorde: eerst de globale guards, dan die van de router, dan die van de route. De eerste guard die een fout teruggeeft, stopt het request. Guards draaien vóór het binden van het request, zodat een client zonder toegang nooit hoort of zijn invoer klopte, en ze gelden ook voor routes die met `gonestly.Handle` zijn geregistreerd.
