---
title: Middleware
description: Gebruik elke net/http-middleware rond je routes of rond de hele server.
---

Middleware omsluit een `http.Handler`, de standaardmanier om `net/http` uit te breiden. Gonestly gebruikt dezelfde signatuur, dus elke middleware die voor `net/http` is geschreven werkt, zoals compressie of rate limiting:

```go
type Middleware = func(http.Handler) http.Handler
```

```go title="middleware/request_id.go"
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = rand.Text()
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r)
	})
}
```

## Waar middleware geldt

Voeg middleware toe aan de routes van een controller met `Use`:

```go
func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/files").Use(middleware.Gzip)
	gonestly.Get(r, "/{id}", c.Download)
}
```

Middleware voor de hele server hoort in de [serverconfiguratie](http-server#configuratie). Die draait ook voor requests die bij geen enkele route passen:

```go
func NewServerConfig(cfg Config, logger *slog.Logger) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		Addr:       fmt.Sprintf(":%d", cfg.Port),
		Middleware: []gonestly.Middleware{gonestly.RequestID(), gonestly.AccessLog(logger), middleware.Gzip},
	}
}
```

In beide gevallen is de eerste middleware in de lijst de buitenste. Voor CORS is geen middleware nodig: dat zit in de [serverconfiguratie](http-server#cors).

## Request-ID's en de access-log

Het framework levert twee stukken middleware mee, en een project van `gonestly new` gebruikt ze allebei.

`gonestly.RequestID()` geeft elk request een ID. De header `X-Request-ID` van een proxy of client blijft behouden zolang die veilig te loggen is; anders komt er een willekeurig ID. Het ID gaat terug in de response-header, en de applicatie zet het in haar eigen logregels over dat request, zoals die van een 500. Lees het in een handler met `gonestly.RequestIDFrom(ctx)`, bijvoorbeeld om het door te geven aan een andere service.

`gonestly.AccessLog(logger)` logt elk request zodra het beantwoord is:

```text
level=INFO msg=request method=GET path=/users/42 request_id=req-1 status=200 bytes=64 duration=1.2ms
```

Een 5xx-status wordt op errorniveau gelogd. Zet `RequestID` vooraan, zodat de access-log het ID kan tonen.

## Rate limiting

`gonestly.RateLimit` antwoordt met **429 Too Many Requests** als één client meer requests stuurt dan je toestaat:

```go
func NewServerConfig(cfg Config, logger *slog.Logger) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		Middleware: []gonestly.Middleware{
			gonestly.RequestID(),
			gonestly.AccessLog(logger),
			gonestly.RateLimit(gonestly.RateLimitConfig{Requests: 300, Window: time.Minute, TrustedProxies: 1}),
		},
	}
}
```

Gebruik hem op een router voor routes die een strengere limiet verdienen, zoals een login:

```go
r.Prefix("/auth").Use(gonestly.RateLimit(gonestly.RateLimitConfig{Requests: 5, Window: time.Minute}))
```

Een client die stil was mag zijn hele quotum in één keer versturen; daarna komt er gelijkmatig over het venster weer ruimte bij. Elk response vertelt de client waar hij staat met de headers `RateLimit-Limit`, `RateLimit-Remaining` en `RateLimit-Reset`, en een 429 heeft `Retry-After`.

| Veld             | Doel                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `Requests`       | Hoeveel requests een client per venster mag sturen.                                                |
| `Window`         | De periode, zoals `time.Minute`.                                                                   |
| `TrustedProxies` | Het aantal reverse proxies voor de applicatie; zie hieronder.                                      |
| `Key`            | Herkent de client zelf, bijvoorbeeld aan een API-key. Een lege key laat het request ongeteld door. |

Een client wordt herkend aan zijn adres; bij IPv6 is dat zijn /64-netwerk, omdat één client daar meestal alle adressen van heeft. Achter een reverse proxy lijkt elk request van de proxy te komen, dus zet `TrustedProxies` op het aantal proxies dat je zelf draait: met `1` is de client het laatste adres in `X-Forwarded-For`, dat je eigen proxy heeft toegevoegd.

> [!WARNING]
> Zet `TrustedProxies` nooit hoger dan het aantal proxies dat je zelf beheert. De rest van `X-Forwarded-For` schrijft de client, die dan voor elk request een nieuw adres kan kiezen.

De tellingen staan in het geheugen, dus elke instantie van de applicatie telt voor zichzelf: met drie instanties achter een load balancer kan een client drie keer de limiet versturen.

## Middleware, guards of interceptors

|                              | Middleware                               | Guards                 | Interceptors                      |
| ---------------------------- | ---------------------------------------- | ---------------------- | --------------------------------- |
| Werkt met                    | `http.ResponseWriter` en `*http.Request` | het request            | het resultaat van de handler      |
| Typisch gebruik              | compressie, request-ID's, rate limiting  | authenticatie, rechten | logging, caching, fouten vertalen |
| Draait voor onbekende routes | als hij globaal is                       | nee                    | nee                               |
| Kan providers injecteren     | via een provider die hem teruggeeft      | ja                     | ja                                |

Gebruik bij voorkeur een guard om te bepalen of een request verder mag, en een interceptor om met resultaten te werken: beide geven fouten terug die Gonestly overal hetzelfde verstuurt. Gebruik middleware voor alles wat bij HTTP zelf hoort.
