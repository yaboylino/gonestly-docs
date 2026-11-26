---
title: Caching
description: Keep the results of slow work for a while, share one load between simultaneous requests, cache whole responses and let clients revalidate.
---

Some work is slow and its answer changes rarely: a report, a call to another service, a list that every visitor asks for. A cache keeps the result for a while, so the work is done once and the answer is ready for everybody else.

> [!NOTE]
> The `cache` and `redis` modules are available from version 0.4.0.

## Setup

```go title="internal/app/module.go"
Imports: gonestly.Imports(
	// ...
	cache.Module(cache.Options{DefaultTTL: time.Minute}),
),
```

Any provider can now inject the `*cache.Cache`. Out of the box it keeps values in the memory of the process, up to 64 MiB, dropping the least recently used when it is full. That is right for one instance. With several instances each has its own cache, and a value changed in one is stale in the others, so use a shared store.

## Remember

`cache.Remember` is the call you will use most. It returns the value under a key, or loads it, stores it and returns it:

```go
func (s *Service) Find(ctx context.Context, id int64) (User, error) {
	return cache.Remember(ctx, s.cache, fmt.Sprintf("user:%d", id), time.Minute,
		func(ctx context.Context) (User, error) {
			return s.repo.Find(ctx, id)
		})
}
```

- **One load for many callers.** When fifty requests ask for a missing key at the same moment, the loader runs once and they share the result. Otherwise every request would compute the popular value while it is gone, which is when the database is least able to cope.
- **Errors are not cached.** A failing loader returns its error to the callers that were waiting, and the next request tries again.
- **A caller that gives up does not fail the others.** The loader keeps the values of the request, such as its [request ID](logging), but does not end with it.
- **A panic in the loader** becomes an error.

Values are stored as JSON, so use types that encode and decode. A stored value that does not fit the type any more, after you changed the type in a deploy, is dropped and loaded again instead of failing.

`cache.Get` and `cache.Set` are the same pieces without the loading, for when you want control. `ttl` 0 means `DefaultTTL`, 5 minutes unless you set it.

## A failing cache is an empty cache

A cache is an optimization, so a request must not fail because the cache is down. When the store returns an error, the call is logged as a warning, counted in `cache.Stats().Errors` and treated as a miss: `Remember` loads the value as if there were no cache.

```go
stats := c.Stats() // Hits, Misses, Loads and Errors
```

## Invalidation

Delete a key when the data behind it changes, or everything under a prefix:

```go
c.Delete(ctx, "user:7")
c.DeletePrefix(ctx, "user:")
c.Clear(ctx) // every key of this cache
```

Give each application its own `Prefix` in the options, so that several applications can use one store without meeting each other's keys, and `Clear` only clears yours.

## Sharing the cache between instances

The `redis` module stores entries in Redis, so that all instances see the same cache:

```sh
go get github.com/yaboylino/gonestly/redis
```

```go
cache.ModuleFunc(func(cfg Config) cache.Options {
	store, err := redis.Open(context.Background(), cfg.RedisURL) // redis://:password@host:6379/0
	// handle err
	return cache.Options{Store: store, Prefix: "shop:", DefaultTTL: time.Minute}
})
```

`rediss://` uses TLS. The store pings Redis when the application is asked whether it is healthy, so a [health check](health-checks) tells when Redis is gone, and closes its connection when the application stops. Deleting by prefix scans the keys in batches without blocking Redis; use it for invalidation now and then, not on every request.

Writing your own store, for Memcached or a database, takes three methods: `Get`, `Set` and `Delete`, and `DeletePrefix` if it can. The `cachetest` package checks that a store keeps the contract.

## Caching responses

`cache.Responses` caches the response of a GET route:

```go
gonestly.Get(r, "/products", c.List,
	gonestly.WithInterceptors(cache.Responses(s.cache, time.Minute)))
```

It is an [interceptor](interceptors), so it runs after the guards, binding and validation: a cached response is only served to a caller that was let in and sent a valid request. The route handler runs once for simultaneous misses, and every response says `X-Cache: HIT` or `MISS`.

What the key is made of decides who shares a response:

| Part of the key                      | Default                                            |
| ------------------------------------ | -------------------------------------------------- |
| Path and query                       | always; the order of parameters does not matter    |
| `Authorization` and `Cookie` headers | each credential has its own response               |
| Other request headers                | `cache.Vary("Accept-Language")` adds them          |
| Your own rule                        | `cache.KeyFunc(...)`; an empty key skips the cache |

The default is safe for data that depends on who asks. When the data is the same for everybody who is allowed to see it, add `cache.SharedAcrossUsers()`, and all callers share one entry.

Errors, responses without a body and other methods are not cached. To invalidate after a change, delete by prefix:

```go
c.DeletePrefix(ctx, cache.ResponsePrefix("/products"))
```

## ETags and revalidation

`cache.ETag()` is middleware that gives GET and HEAD responses an `ETag`, a fingerprint of the body, and answers **304 Not Modified** without a body when a client sends it back in `If-None-Match`:

```go
gonestly.ServerConfig{Middleware: []gonestly.Middleware{cache.ETag()}}
```

Browsers, mobile apps and CDNs then revalidate for the price of a header instead of downloading the response again. It is independent of the cache store, and leaves an ETag that your handler set alone. Responses over 1 MiB and streams pass untouched.

## Options

| Option       | Default           | Meaning                                            |
| ------------ | ----------------- | -------------------------------------------------- |
| `Store`      | memory, 64 MiB    | Where the values live.                             |
| `Prefix`     | none              | Put before every key.                              |
| `DefaultTTL` | 5 minutes         | How long a value lives when the call does not say. |
| `Logger`     | the application's | Receives the failures of the store.                |
