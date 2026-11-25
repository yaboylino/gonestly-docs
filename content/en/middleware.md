---
title: Middleware
description: Use any net/http middleware around your routes or around the whole server.
---

Middleware wraps an `http.Handler`, the standard way to extend `net/http`. Gonestly uses the same signature, so every middleware written for `net/http` works, such as CORS, compression or request IDs:

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

Middleware for the whole server goes into the [server configuration](http-server#configuration). It also runs for requests that match no route, which matters for CORS preflight requests:

```go
func NewServerConfig(cfg Config) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		Addr:       fmt.Sprintf(":%d", cfg.Port),
		Middleware: []gonestly.Middleware{middleware.RequestID, cors.Handler},
	}
}
```

In both cases the first middleware in the list is the outermost.

## Middleware, guards or interceptors

|                         | Middleware                                | Guards                      | Interceptors                    |
| ----------------------- | ----------------------------------------- | --------------------------- | ------------------------------- |
| Works with              | `http.ResponseWriter` and `*http.Request` | the request                 | the handler's result            |
| Typical use             | CORS, compression, request IDs            | authentication, permissions | logging, caching, error mapping |
| Runs for unknown routes | when global                               | no                          | no                              |
| Can inject providers    | through a provider that returns it        | yes                         | yes                             |

Prefer a guard to decide whether a request may continue and an interceptor to work with results, because both return errors that Gonestly renders consistently. Use middleware for everything that belongs to HTTP itself.
