---
title: Middleware
description: Gebruik elke net/http-middleware rond je routes of rond de hele server.
---

Middleware omsluit een `http.Handler`, de standaardmanier om `net/http` uit te breiden. Gonestly gebruikt dezelfde signatuur, dus elke middleware die voor `net/http` is geschreven werkt, zoals CORS, compressie of request-ID's:

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

Middleware voor de hele server hoort in de [serverconfiguratie](http-server#configuratie). Die draait ook voor requests die bij geen enkele route passen, wat belangrijk is voor CORS-preflightrequests:

```go
func NewServerConfig(cfg Config, logger *slog.Logger) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		Addr:       fmt.Sprintf(":%d", cfg.Port),
		Middleware: []gonestly.Middleware{gonestly.RequestID(), gonestly.AccessLog(logger), cors.Handler},
	}
}
```

In beide gevallen is de eerste middleware in de lijst de buitenste.

## Request-ID's en de access-log

Het framework levert twee stukken middleware mee, en een project van `gonestly new` gebruikt ze allebei.

`gonestly.RequestID()` geeft elk request een ID. De header `X-Request-ID` van een proxy of client blijft behouden zolang die veilig te loggen is; anders komt er een willekeurig ID. Het ID gaat terug in de response-header, en de applicatie zet het in haar eigen logregels over dat request, zoals die van een 500. Lees het in een handler met `gonestly.RequestIDFrom(ctx)`, bijvoorbeeld om het door te geven aan een andere service.

`gonestly.AccessLog(logger)` logt elk request zodra het beantwoord is:

```text
level=INFO msg=request method=GET path=/users/42 request_id=req-1 status=200 bytes=64 duration=1.2ms
```

Een 5xx-status wordt op errorniveau gelogd. Zet `RequestID` vooraan, zodat de access-log het ID kan tonen.

## Middleware, guards of interceptors

|                              | Middleware                               | Guards                 | Interceptors                      |
| ---------------------------- | ---------------------------------------- | ---------------------- | --------------------------------- |
| Werkt met                    | `http.ResponseWriter` en `*http.Request` | het request            | het resultaat van de handler      |
| Typisch gebruik              | CORS, compressie, request-ID's           | authenticatie, rechten | logging, caching, fouten vertalen |
| Draait voor onbekende routes | als hij globaal is                       | nee                    | nee                               |
| Kan providers injecteren     | via een provider die hem teruggeeft      | ja                     | ja                                |

Gebruik bij voorkeur een guard om te bepalen of een request verder mag, en een interceptor om met resultaten te werken: beide geven fouten terug die Gonestly overal hetzelfde verstuurt. Gebruik middleware voor alles wat bij HTTP zelf hoort.
