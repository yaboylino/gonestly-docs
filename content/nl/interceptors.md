---
title: Interceptors
description: Interceptors omsluiten de handlers van routes om er logging, timing, caching of het vertalen van fouten omheen te zetten.
---

Een interceptor omsluit de handler van een route. Hij kan code uitvoeren vóór en na de handler, het resultaat of de fout aanpassen, of antwoorden zonder de handler aan te roepen.

```go
type Interceptor interface {
	Intercept(ctx context.Context, r *http.Request, next gonestly.Next) (any, error)
}
```

`next` roept de volgende interceptor of de handler aan en geeft het resultaat terug.

## Requests timen

```go title="observability/timing.go"
type Timing struct {
	logger *slog.Logger
}

func NewTiming(logger *slog.Logger) *Timing {
	return &Timing{logger: logger}
}

func (t *Timing) Intercept(ctx context.Context, r *http.Request, next gonestly.Next) (any, error) {
	start := time.Now()
	result, err := next(ctx)
	t.logger.InfoContext(ctx, "handled", "path", r.URL.Path, "duration", time.Since(start), "failed", err != nil)
	return result, err
}
```

Net als guards zijn interceptors meestal providers, geïnjecteerd in de controllers of de serverconfiguratie die ze gebruiken.

## Het resultaat aanpassen

Een interceptor kan elk response in een envelop verpakken, of fouten omzetten in HTTP-fouten:

```go
var Envelope = gonestly.InterceptorFunc(func(ctx context.Context, r *http.Request, next gonestly.Next) (any, error) {
	result, err := next(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{"data": result}, nil
})
```

Zie [foutafhandeling](exception-handling#domeinfouten-vertalen) voor een interceptor die van `sql.ErrNoRows` een 404 maakt.

## Antwoorden zonder handler

Een interceptor die `next` niet aanroept, antwoordt zelf. Zo werkt een cache:

```go
func (c *Cache) Intercept(ctx context.Context, r *http.Request, next gonestly.Next) (any, error) {
	if cached, ok := c.store.Get(r.URL.String()); ok {
		return cached, nil
	}
	result, err := next(ctx)
	if err == nil {
		c.store.Set(r.URL.String(), result)
	}
	return result, err
}
```

## Waar interceptors gelden

| Bereik                                    | Hoe                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Elke route van de applicatie              | `Interceptors` in de [serverconfiguratie](http-server#configuratie) |
| De routes die daarna worden geregistreerd | `r.Intercept(...)`                                                  |
| Eén route                                 | de optie `gonestly.WithInterceptors(...)`                           |

De eerste interceptor in een lijst is de buitenste, en globale interceptors omsluiten die van de router, die op hun beurt die van de route omsluiten. Interceptors draaien na de [guards](guards) en nadat het request is gebonden en gevalideerd, dus ze zien altijd een geldig request. Voor routes die met `gonestly.Handle` zijn geregistreerd, gelden ze niet.
