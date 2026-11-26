---
title: Logging
description: Structured logs with a request ID on every line, an access log you can tune, and a logger configured from the environment.
---

Gonestly logs with the standard library's `log/slog`. Every provider can inject a `*slog.Logger`, and the application builds it once, so there is one place to decide how logs look.

> [!NOTE]
> Context aware logs, `LogAttrs`, `NewLogger` and the access log options are available from version 0.4.0.

## Configuring the logger

A project made with `gonestly new` reads two settings from the environment or `.env`:

| Setting      | Values                           | Default |
| ------------ | -------------------------------- | ------- |
| `LOG_LEVEL`  | `debug`, `info`, `warn`, `error` | `info`  |
| `LOG_FORMAT` | `text`, `json`, `auto`           | `auto`  |

`auto` writes readable text to a terminal and under `gonestly dev`, and JSON to anything else, such as the log collector of your server. A wrong value stops the application from starting and says what was wrong.

The code behind it is `gonestly.NewLogger`, which you can call yourself and pass to the application:

```go title="main.go"
logger, err := gonestly.NewLogger(gonestly.LogOptions{Level: "debug", Format: "json"})
if err != nil {
	return err
}
application, err := gonestly.New(app.Module, gonestly.WithLogger(logger))
```

Any other `slog` handler works too: `WithLogger` takes a `*slog.Logger`.

## The request ID on every line

The application wraps its logger so that a line logged with the context of a request carries the ID of that request, whatever code writes it:

```go
func (s *Service) Charge(ctx context.Context, id int64) error {
	s.logger.InfoContext(ctx, "charging", "order", id)
	// level=INFO msg=charging order=42 request_id=3f1c...
	return s.gateway.Charge(ctx, id)
}
```

Pass the context of the request on, and use the `Context` methods (`InfoContext`, `WarnContext`, `ErrorContext`). The database logs its queries the same way, so a slow query in the debug log leads back to its request. The ID comes from the `X-Request-ID` header when a proxy or client sent a safe one, and is random otherwise; see [middleware](middleware#request-ids-and-the-access-log).

## Adding details

`gonestly.LogAttrs` adds attributes to every line about the request from that moment on, including the access log line that is written when the request ends. A guard is the natural place to say who is calling:

```go
func (g *Guard) Check(ctx context.Context, r *http.Request) (context.Context, error) {
	claims, err := g.tokens.Verify(r.Header.Get("Authorization"))
	if err != nil {
		return nil, err
	}
	gonestly.LogAttrs(ctx, slog.String("user_id", claims.Subject))
	return ctx, nil
}
```

Now the line that closes the request says `user_id=...` as well. One line per request that tells the whole story is easier to search than five lines that have to be joined.

## The access log

`gonestly.AccessLog` writes one line per request when it has been answered:

```text
level=INFO msg=request method=GET path=/users/42 request_id=3f1c status=200 bytes=64 duration=1.2ms route=/users/{id} remote_addr=10.0.0.7 user_agent=curl/8.5
```

`route` is the pattern that handled the request, so you can group by it without a different path for every id. `remote_addr` is the address of the connection: behind a proxy that is the proxy.

Two options keep it useful:

```go
gonestly.AccessLog(logger,
	gonestly.SkipPaths("/health/*"),            // a load balancer asks every few seconds
	gonestly.SlowAfter(500*time.Millisecond),   // slower requests log at warn level with slow=true
)
```

A 5xx status logs at error level, a slow request at warn level, everything else at info level.

## Background jobs

A [background job](background-jobs) remembers the request that enqueued it. When it runs, its context carries the same request ID, so the logs of the request and of the work it started can be followed with one search.
