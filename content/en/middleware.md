---
title: Middleware
description: Use any net/http middleware around your routes or around the whole server.
---

Middleware wraps an `http.Handler`, the standard way to extend `net/http`. Gonestly uses the same signature, so every middleware written for `net/http` works, such as compression or rate limiting:

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

## Where middleware applies

Add middleware to the routes of a controller with `Use`:

```go
func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/files").Use(middleware.Gzip)
	gonestly.Get(r, "/{id}", c.Download)
}
```

Middleware for the whole server goes into the [server configuration](http-server#configuration). It also runs for requests that match no route:

```go
func NewServerConfig(cfg Config, logger *slog.Logger) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		Addr:       fmt.Sprintf(":%d", cfg.Port),
		Middleware: []gonestly.Middleware{gonestly.RequestID(), gonestly.AccessLog(logger), middleware.Gzip},
	}
}
```

In both cases the first middleware in the list is the outermost. CORS needs no middleware: it is part of the [server configuration](http-server#cors).

## Request IDs and the access log

Two pieces of middleware come with the framework, and a project made with `gonestly new` uses both.

`gonestly.RequestID()` gives every request an ID. It keeps the `X-Request-ID` header that a proxy or client sent, as long as it is safe to log, and makes a random one otherwise. The ID goes back in the response header, and the application adds it to its own log lines about that request, such as the one for a 500. Read it in a handler with `gonestly.RequestIDFrom(ctx)`, for example to pass it on to another service.

`gonestly.AccessLog(logger)` logs every request once it is answered:

```text
level=INFO msg=request method=GET path=/users/42 request_id=req-1 status=200 bytes=64 duration=1.2ms
```

A 5xx status is logged at error level. Put `RequestID` first, so the access log can show the ID.

## Middleware, guards or interceptors

|                         | Middleware                                | Guards                      | Interceptors                    |
| ----------------------- | ----------------------------------------- | --------------------------- | ------------------------------- |
| Works with              | `http.ResponseWriter` and `*http.Request` | the request                 | the handler's result            |
| Typical use             | compression, request IDs, rate limiting   | authentication, permissions | logging, caching, error mapping |
| Runs for unknown routes | when global                               | no                          | no                              |
| Can inject providers    | through a provider that returns it        | yes                         | yes                             |

Prefer a guard to decide whether a request may continue and an interceptor to work with results, because both return errors that Gonestly renders consistently. Use middleware for everything that belongs to HTTP itself.
