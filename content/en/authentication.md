---
title: Authentication
description: Authenticate requests with JSON Web Tokens using the jwt module, with a ready-made guard, the caller in the context and roles per route.
---

The `jwt` module authenticates requests with JSON Web Tokens. It signs and verifies tokens, and its [guard](guards) protects routes, puts the caller in the context and can require a role. Like the SQL layer it lives in its own Go module:

```sh
go get github.com/yaboylino/gonestly/jwt
```

## Setting it up

Import the module in the root module, with a secret from your [configuration](configuration):

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

Every module can now inject `*jwt.Tokens`. The secret needs at least 32 bytes; generate one with `openssl rand -base64 48`. Wrong options stop the application from starting, with a message that says what to change.

## Signing a token

After you have checked a password, or whatever proves who the caller is, sign a token:

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

`Sign` adds the time of issue and the expiry. A token is valid for an hour unless you set `Options.TTL` or `Claims.ExpiresAt`.

## Protecting routes

`tokens.Guard()` lets a request through when it carries a valid token as `Authorization: Bearer <token>`:

```go title="orders/controller.go"
func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/orders").Guard(c.tokens.Guard())
	gonestly.Get(r, "/", c.List)
	gonestly.Delete(r, "/{id}", c.Delete, gonestly.WithGuards(c.tokens.Guard("admin")))
}
```

With roles, the caller needs at least one of them. The guard answers for you:

| Situation                               | Response                          |
| --------------------------------------- | --------------------------------- |
| No token, or not a bearer token         | 401, `a bearer token is required` |
| A wrong signature, issuer or audience   | 401, `the token is invalid`       |
| An expired token                        | 401, `the token has expired`      |
| A valid token without the required role | 403, `this needs the role admin`  |

Why a token was refused is logged at debug level and never sent to the client. The routes appear in the [API documentation](openapi) with a bearer token, so Swagger UI offers an Authorize button.

## Who is calling

A handler reads the claims of the accepted token from the context:

```go
func (c *Controller) List(ctx context.Context, req ListRequest) ([]Order, error) {
	claims, _ := jwt.ClaimsFrom(ctx)
	return c.service.ListFor(ctx, claims.Subject)
}
```

`Claims` holds the `Subject`, the `Roles`, the times and every other claim in `Extra`. `claims.HasRole("admin")` checks a role in your own logic.

## Keys instead of a secret

Set exactly one of these options:

| Option       | Use it when                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `Secret`     | One application signs and verifies its own tokens.                                                             |
| `PrivateKey` | This application signs, and others verify with the public key. RSA, ECDSA or Ed25519, in PEM format.           |
| `PublicKey`  | Another service signs the tokens and this application only verifies them.                                      |
| `JWKSURL`    | An identity provider such as Keycloak, Auth0 or Entra ID signs the tokens; its keys are fetched and refreshed. |

```go
jwt.Options{
	JWKSURL:    "https://id.example.com/realms/shop/protocol/openid-connect/certs",
	Issuer:     "https://id.example.com/realms/shop",
	RolesClaim: "realm_access.roles",
}
```

The other options:

| Option               | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `Issuer`, `Audience` | Written into signed tokens and required in verified ones.                   |
| `TTL`                | How long a signed token is valid; an hour by default.                       |
| `Leeway`             | How much the clocks of the signer and the verifier may differ.              |
| `RolesClaim`         | The claim with the roles, `roles` by default. A dot reaches into an object. |

A token without an expiry is always refused, and so is a token signed with another algorithm than the configured key uses.

## Testing

Sign a token in the test with the same `*jwt.Tokens` the application uses:

```go
tokens := gonestlytest.Resolve[*jwt.Tokens](app)
token, _ := tokens.Sign(jwt.Claims{Subject: "42", Roles: []string{"admin"}})
app.Delete("/orders/1", "Authorization", "Bearer "+token).ExpectStatus(http.StatusNoContent)
```
