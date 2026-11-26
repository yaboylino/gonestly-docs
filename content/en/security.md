---
title: Security
description: Security headers, protection against cross-site request forgery, and finding the real client behind a proxy.
---

An API answers browsers, scripts and other servers, and the browser is the one that needs protecting: it holds the cookies of a user and will happily send them to whoever asks. Gonestly has three pieces of middleware for it, and a project made with `gonestly new` uses the first and the last.

> [!NOTE]
> These pieces are available from version 0.4.0. Passwords have their own page: [passwords](passwords).

## Security headers

`gonestly.SecurityHeaders` adds the headers that browsers use to protect their users. With the zero value it sets what is right for an API:

| Header                         | Default                                           | Protects against                               |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| `Strict-Transport-Security`    | 2 years, on HTTPS only                            | downgrades to plain HTTP                       |
| `X-Content-Type-Options`       | `nosniff`                                         | a browser guessing that JSON is a script       |
| `Content-Security-Policy`      | `default-src 'none'; ...; frame-ancestors 'none'` | a response loading or doing anything in a page |
| `X-Frame-Options`              | `DENY`                                            | clickjacking                                   |
| `Referrer-Policy`              | `no-referrer`                                     | leaking URLs to other sites                    |
| `Permissions-Policy`           | camera, microphone, location and payment off      | features you do not use                        |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                     | other windows reaching into yours              |
| `Cross-Origin-Resource-Policy` | `same-origin`                                     | other sites embedding your responses           |

Each field of `SecurityHeadersConfig` changes one header, and `"off"` leaves it out:

```go
gonestly.SecurityHeaders(gonestly.SecurityHeadersConfig{
	HSTSIncludeSubdomains: true,
	FrameOptions:          "SAMEORIGIN",
	CrossOriginResourcePolicy: "off",
})
```

HSTS is only sent over HTTPS, since a browser ignores it elsewhere. Behind a proxy that ends TLS, set `TrustForwardedProto` so that `X-Forwarded-Proto: https` counts, and only when a proxy you control sets that header. Turn on `HSTSPreload` only when every subdomain speaks HTTPS: it is hard to undo.

A handler can set another value for its own response. The API documentation does: Swagger UI loads its code from a CDN, so `/docs` carries a policy that allows exactly that script and nothing else, while the rest of the API keeps the strict one.

## Cross-site request forgery

A page on another site can make the browser of a visitor send a request to your API, with the cookies of your site attached. `gonestly.CrossOriginProtection` refuses it: any request that changes something (not GET, HEAD or OPTIONS) is answered with **403 Forbidden** when the browser says it comes from another site. It looks at the `Sec-Fetch-Site` and `Origin` headers, which browsers add and pages cannot forge, so there is no token to manage.

```go
gonestly.CrossOriginProtection("https://app.example.com")
```

Requests without those headers, such as from curl, a mobile app or another server, pass: they are not the browser of a victim. Pass the origins of your own frontends on other sites as trusted; same-site and same-origin requests need nothing.

You need it when the API accepts **cookies**. An API that only takes a bearer token in the `Authorization` header does not need it, because a forged request cannot add the token. It panics at start for an origin that is not a scheme and a host.

## Behind a proxy

Behind a load balancer or reverse proxy, the address of every connection is the proxy. `gonestly.TrustProxies` finds the client:

```go
gonestly.TrustProxies(1) // one proxy that you control
```

The number is how many proxies in front of the application you control. With one, the client is the last address in `X-Forwarded-For`, which your proxy added; anything a client wrote before that is ignored. Never set it higher than the number of proxies you control, or clients can choose their own address.

Once it is in place, `gonestly.ClientIP(ctx)` returns the client, the [access log](logging#the-access-log) writes it as `remote_addr`, and [rate limiting](middleware#rate-limiting) counts by it. A project made with `gonestly new` reads the number from `TRUSTED_PROXIES`, 0 by default.
