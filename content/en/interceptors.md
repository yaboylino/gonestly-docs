---
title: Interceptors
description: Interceptors wrap route handlers to add logging, timing, caching or error mapping around them.
---

An interceptor wraps the handler of a route. It can run code before and after the handler, change its result or its error, or answer without calling it at all.

```go
type Interceptor interface {
	Intercept(ctx context.Context, r *http.Request, next gonestly.Next) (any, error)
}
```

`next` calls the next interceptor, or the handler, and returns its result.

## Timing requests

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

Like guards, interceptors are usually providers, injected into the controllers or the server configuration that use them.

## Changing the result

An interceptor can wrap every response in an envelope, or map errors to HTTP errors:

```go
var Envelope = gonestly.InterceptorFunc(func(ctx context.Context, r *http.Request, next gonestly.Next) (any, error) {
	result, err := next(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{"data": result}, nil
})
```

See [exception handling](exception-handling#mapping-domain-errors) for an interceptor that turns `sql.ErrNoRows` into a 404.

## Answering without the handler

An interceptor that does not call `next` answers on its own, which is how a cache works:

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

## Where interceptors apply

| Scope                          | How                                                                     |
| ------------------------------ | ----------------------------------------------------------------------- |
| Every route of the application | `Interceptors` in the [server configuration](http-server#configuration) |
| The routes registered after it | `r.Intercept(...)`                                                      |
| One route                      | the option `gonestly.WithInterceptors(...)`                             |

The first interceptor in a list is the outermost, and global interceptors wrap those of the router, which wrap those of the route. Interceptors run after the [guards](guards) and after the request is bound and validated, so they always see a valid request. They do not apply to routes registered with `gonestly.Handle`.
