---
title: Versioning
description: Run several versions of an API side by side, let clients choose with the path or a header, and retire a version with warnings that clients can read.
---

An API that people depend on cannot change under their feet. When a change would break them, you publish it as a new version and keep the old one working until they have moved. Gonestly puts the version in the path, lets clients choose with a header if you prefer, and tells clients when a version is on its way out.

> [!NOTE]
> Versioning is available from version 0.4.0.

## Registering a version

`Router.Version` puts the routes after it under a version. Group the routes of each version, and put the version before the prefix:

```go title="internal/users/controller_v2.go"
func (c *ControllerV2) Routes(r *gonestly.Router) {
	r.Version("2").Prefix("/users")
	gonestly.Get(r, "", c.List)            // GET /v2/users
	gonestly.Get(r, "/{id}", c.Find)       // GET /v2/users/{id}
}
```

A version is a number such as `1` or `1.1`, with or without the `v`. Two controllers, one per version, can sit in the same module and share the same service: only the part that changed needs a new handler and response type. Every response of a versioned route says which version answered:

```text
API-Version: 2
```

Routes without a version, such as the [health checks](health-checks), stay where they are.

## Choosing with a header

Some teams prefer clean paths and a header for the version. Turn it on in the server configuration:

```go
gonestly.ServerConfig{
	Versioning: gonestly.VersioningConfig{Header: "API-Version", Default: "1"},
}
```

Now `GET /users` with `API-Version: 2` is answered by the routes of version 2, and without the header by version 1. The path with a version, `/v2/users`, always wins over the header. A header with a version that does not exist is answered with **400 Bad Request** and a list of the versions that do; a method that a version does not have is answered with 405 as usual.

`Default` is optional. Without it, an unversioned path only reaches routes that have no version, and a client has to say which one it wants. Setting `Default` to a version without routes stops the application from starting.

## Retiring a version

Tell clients before you remove something. `Deprecate` marks every route after it, and the options say when and what replaces it:

```go
r.Version("1").Deprecate(
	gonestly.DeprecatedSince(time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)),
	gonestly.SunsetAt(time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)),
	gonestly.SuccessorAt("/v2/users"),
).Prefix("/users")
```

Every response of those routes then carries:

```text
Deprecation: @1772323200
Sunset: Thu, 31 Dec 2026 00:00:00 GMT
Link: </v2/users>; rel="successor-version"
```

These are the headers of RFC 9745 and RFC 8594, which API clients and gateways know how to read, so they can warn their developers long before the date. The OpenAPI document marks the routes as deprecated and says in their description when they stop working.

For one route use the option instead: `gonestly.Deprecated(gonestly.SunsetAt(date))`. `gonestly.Deprecated()` without options only marks the OpenAPI document.

The sunset date is information, not a switch: the route keeps working after it. When the date has passed and your logs show no more traffic, delete the version, with its controller and tests, like any removed feature.

## Documentation per version

The OpenAPI document of the whole API lists every version. Each version also has its own document, for generating a client:

```text
/openapi.json            every version
/openapi.json?version=2  only /v2 routes
```

The documentation page at `/docs` gets a selector to switch between them.
