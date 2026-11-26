---
title: Authenticatie
description: Authenticeer requests met JSON Web Tokens via de jwt-module, met een kant-en-klare guard, de aanroeper in de context en rollen per route.
---

De module `jwt` authenticeert requests met JSON Web Tokens. Hij ondertekent en controleert tokens, en zijn [guard](guards) beschermt routes, zet de aanroeper in de context en kan een rol eisen. Net als de SQL-laag staat hij in een eigen Go-module:

```sh
go get github.com/yaboylino/gonestly/jwt
```

## Instellen

Importeer de module in de root-module, met een secret uit je [configuratie](configuration):

```go title="internal/app/module.go"
type Config struct {
	JWTSecret string `env:"JWT_SECRET,required"`
}

var Module = &gonestly.Module{
	Name: "app",
	Imports: gonestly.Imports(
		config.Module[Config](config.Options{}),
		jwt.ModuleFunc(func(cfg Config) jwt.Options {
			return jwt.Options{Secret: cfg.JWTSecret, Issuer: "shop"}
		}),
		users.Module,
	),
}
```

Elke module kan nu `*jwt.Tokens` injecteren. De secret heeft minstens 32 bytes nodig; maak er een met `openssl rand -base64 48`. Verkeerde opties houden de applicatie tegen bij het starten, met een melding die zegt wat je moet aanpassen.

## Een token ondertekenen

Nadat je een wachtwoord hebt gecontroleerd, of wat er ook bewijst wie de aanroeper is, onderteken je een token:

```go title="users/service.go"
func (s *Service) Login(ctx context.Context, req LoginRequest) (LoginResponse, error) {
	user, err := s.verify(ctx, req.Email, req.Password)
	if err != nil {
		return LoginResponse{}, gonestly.Unauthorized("the email or password is wrong")
	}
	token, err := s.tokens.Sign(jwt.Claims{
		Subject: strconv.FormatInt(user.ID, 10),
		Roles:   user.Roles,
		Extra:   map[string]any{"email": user.Email},
	})
	return LoginResponse{Token: token}, err
}
```

`Sign` voegt het moment van uitgifte en de vervaltijd toe. Een token is een uur geldig, tenzij je `Options.TTL` of `Claims.ExpiresAt` zet.

## Routes beschermen

`tokens.Guard()` laat een request door als het een geldig token meestuurt als `Authorization: Bearer <token>`:

```go title="orders/controller.go"
func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/orders").Guard(c.tokens.Guard())
	gonestly.Get(r, "/", c.List)
	gonestly.Delete(r, "/{id}", c.Delete, gonestly.WithGuards(c.tokens.Guard("admin")))
}
```

Met rollen heeft de aanroeper er minstens één van nodig. De guard antwoordt voor je:

| Situatie                                       | Response                          |
| ---------------------------------------------- | --------------------------------- |
| Geen token, of geen bearer-token               | 401, `a bearer token is required` |
| Een verkeerde handtekening, issuer of audience | 401, `the token is invalid`       |
| Een verlopen token                             | 401, `the token has expired`      |
| Een geldig token zonder de vereiste rol        | 403, `this needs the role admin`  |

Waarom een token is geweigerd wordt op debugniveau gelogd en nooit naar de client gestuurd. De routes staan in de [API-documentatie](openapi) met een bearer-token, zodat Swagger UI een Authorize-knop toont.

## Wie roept er aan

Een handler leest de claims van het geaccepteerde token uit de context:

```go
func (c *Controller) List(ctx context.Context, req ListRequest) ([]Order, error) {
	claims, _ := jwt.ClaimsFrom(ctx)
	return c.service.ListFor(ctx, claims.Subject)
}
```

`Claims` bevat het `Subject`, de `Roles`, de tijden en elke andere claim in `Extra`. Met `claims.HasRole("admin")` controleer je een rol in je eigen logica.

## Sleutels in plaats van een secret

Zet precies één van deze opties:

| Optie        | Gebruik hem als                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `Secret`     | Eén applicatie haar eigen tokens ondertekent en controleert.                                                             |
| `PrivateKey` | Deze applicatie ondertekent, en andere controleren met de publieke sleutel. RSA, ECDSA of Ed25519, in PEM-formaat.       |
| `PublicKey`  | Een andere service de tokens ondertekent en deze applicatie ze alleen controleert.                                       |
| `JWKSURL`    | Een identity provider zoals Keycloak, Auth0 of Entra ID de tokens ondertekent; de sleutels worden opgehaald en ververst. |

```go
jwt.Options{
	JWKSURL:    "https://id.example.com/realms/shop/protocol/openid-connect/certs",
	Issuer:     "https://id.example.com/realms/shop",
	RolesClaim: "realm_access.roles",
}
```

De overige opties:

| Optie                | Doel                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| `Issuer`, `Audience` | Worden in ondertekende tokens gezet en zijn verplicht in gecontroleerde tokens. |
| `TTL`                | Hoe lang een ondertekend token geldig is; standaard een uur.                    |
| `Leeway`             | Hoeveel de klokken van de ondertekenaar en de controleur mogen verschillen.     |
| `RolesClaim`         | De claim met de rollen, standaard `roles`. Een punt reikt in een object.        |

Een token zonder vervaltijd wordt altijd geweigerd, net als een token dat met een ander algoritme is ondertekend dan de ingestelde sleutel gebruikt.

## Testen

Onderteken in de test een token met dezelfde `*jwt.Tokens` als de applicatie gebruikt:

```go
tokens := gonestlytest.Resolve[*jwt.Tokens](app)
token, _ := tokens.Sign(jwt.Claims{Subject: "42", Roles: []string{"admin"}})
app.Delete("/orders/1", "Authorization", "Bearer "+token).ExpectStatus(http.StatusNoContent)
```
