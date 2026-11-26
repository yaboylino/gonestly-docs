---
title: HTTP server
description: Configure the HTTP server that serves your controllers, its address, timeouts and limits, and how it starts and stops.
---

As soon as an application has a [controller](controllers), Gonestly serves it with an HTTP server from `net/http`. There is nothing to start yourself: `app.Run` starts it and shuts it down gracefully.

## Lifecycle

The server starts after every provider has started, so a request never reaches a provider that is not ready. On shutdown it stops first: it stops accepting connections and waits for running requests, within the shutdown timeout, before the providers stop.

If the address is already in use, `Start` fails and stops the providers that already started. If the server stops unexpectedly while running, the application shuts down and `Run` returns the error.

## Configuration

Provide a `gonestly.ServerConfig` in the root module to change the defaults, typically built from your [configuration](configuration):

```go title="main.go"
func NewServerConfig(cfg Config) gonestly.ServerConfig {
	return gonestly.ServerConfig{Addr: fmt.Sprintf(":%d", cfg.Port)}
}

var AppModule = &gonestly.Module{
	Name:      "app",
	Imports:   gonestly.Imports(config.Module[Config](config.Options{}), users.Module),
	Providers: gonestly.Providers(NewServerConfig),
}
```

| Field               | Default | Purpose                                          |
| ------------------- | ------- | ------------------------------------------------ |
| `Addr`              | `:3000` | The address to listen on.                        |
| `ReadHeaderTimeout` | 10s     | Time to read the request headers.                |
| `ReadTimeout`       | 30s     | Time to read the whole request.                  |
| `WriteTimeout`      | 30s     | Time to write the response.                      |
| `IdleTimeout`       | 120s    | Time a keep-alive connection may stay idle.      |
| `MaxBodyBytes`      | 1 MiB   | The largest request body; larger bodies get 413. |
| `Middleware`        | none    | [Middleware](middleware) around every request.   |
| `CORS`              | none    | The [origins](#cors) that may call the API.      |
| `Guards`            | none    | [Guards](guards) before every route.             |
| `Interceptors`      | none    | [Interceptors](interceptors) around every route. |

The timeouts protect the server against slow clients; keep them unless you have a reason, such as long uploads.

## CORS

A browser only lets a page call an API on another origin when the API allows it. This is the case for a frontend on its own domain, or on `localhost:4200` during development. List the origins of your frontends:

```go
func NewServerConfig(cfg Config) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		CORS: gonestly.CORSConfig{AllowedOrigins: []string{"https://app.example.com"}},
	}
}
```

The server then answers the preflight requests of the browser and adds the CORS headers to every response, including errors. A project made with `gonestly new` reads the origins from `CORS_ORIGINS`, separated by commas.

| Field              | Default                                | Purpose                                                            |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------ |
| `AllowedOrigins`   | none                                   | The origins that may call the API. Without them, CORS is off.      |
| `AllowedMethods`   | GET, HEAD, POST, PUT, PATCH and DELETE | The methods a page may use.                                        |
| `AllowedHeaders`   | every header                           | The request headers a page may send.                               |
| `ExposedHeaders`   | `X-Request-ID`                         | The response headers a page may read.                              |
| `AllowCredentials` | `false`                                | Lets the browser send cookies and HTTP authentication.             |
| `MaxAge`           | 10 minutes                             | How long a browser may remember the answer to a preflight request. |

An origin is a scheme and a host, without a path: `https://app.example.com`. `https://*.example.com` allows every subdomain, which suits preview deployments, and `*` allows every origin, for a public API.

A mistake is reported when the application starts: an origin with a path or a trailing slash, or `AllowCredentials` together with `*`, which browsers refuse.

> [!WARNING]
> CORS is not access control. It tells browsers which pages may read the responses; other clients can still call the API. Protect routes with [guards](guards).

## Choosing a port automatically

With port 0, the operating system picks a free port. `app.Addr` tells which one:

```go
gonestly.ServerConfig{Addr: "127.0.0.1:0"}
// after Start:
fmt.Println(app.Addr()) // 127.0.0.1:52341
```

## Serving the handler yourself

To serve the application from your own server, or to embed it in another one, build it without listening and use its handler:

```go
app, err := gonestly.New(AppModule, gonestly.WithoutListener())
// after Start:
http.Handle("/api/", http.StripPrefix("/api", app.Handler()))
```

[Tests](testing) use the same approach through the `gonestlytest` package.

## API documentation

The server also serves the [OpenAPI](openapi) document at `/openapi.json` and Swagger UI at `/docs`. Configure or disable them with `gonestly.OpenAPIConfig`.

## Listing the routes

`app.Routes` returns every route with its method, path and controller, for example to print them at startup or check them in a test:

```go
for _, route := range app.Routes() {
	fmt.Println(route.Method, route.Path)
}
```
