---
title: Beveiliging
description: Beveiligingsheaders, bescherming tegen cross-site request forgery en de echte client vinden achter een proxy.
---

Een API beantwoordt browsers, scripts en andere servers, en de browser is degene die bescherming nodig heeft: hij bewaart de cookies van een gebruiker en stuurt ze graag naar iedereen die erom vraagt. Gonestly heeft er drie stukken middleware voor, en een project van `gonestly new` gebruikt de eerste en de laatste.

> [!NOTE]
> Deze onderdelen zijn beschikbaar vanaf versie 0.4.0. Wachtwoorden hebben een eigen pagina: [wachtwoorden](passwords).

## Beveiligingsheaders

`gonestly.SecurityHeaders` voegt de headers toe die browsers gebruiken om hun gebruikers te beschermen. Met de nulwaarde zet hij wat voor een API goed is:

| Header                         | Standaard                                         | Beschermt tegen                                   |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------- |
| `Strict-Transport-Security`    | 2 jaar, alleen op HTTPS                           | terugval naar gewoon HTTP                         |
| `X-Content-Type-Options`       | `nosniff`                                         | een browser die JSON voor een script aanziet      |
| `Content-Security-Policy`      | `default-src 'none'; ...; frame-ancestors 'none'` | een antwoord dat iets laadt of doet in een pagina |
| `X-Frame-Options`              | `DENY`                                            | clickjacking                                      |
| `Referrer-Policy`              | `no-referrer`                                     | het lekken van URL's naar andere sites            |
| `Permissions-Policy`           | camera, microfoon, locatie en betalen uit         | functies die je niet gebruikt                     |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                     | andere vensters die in het jouwe reiken           |
| `Cross-Origin-Resource-Policy` | `same-origin`                                     | andere sites die jouw antwoorden insluiten        |

Elk veld van `SecurityHeadersConfig` verandert één header, en `"off"` laat hem weg:

```go
gonestly.SecurityHeaders(gonestly.SecurityHeadersConfig{
	HSTSIncludeSubdomains: true,
	FrameOptions:          "SAMEORIGIN",
	CrossOriginResourcePolicy: "off",
})
```

HSTS wordt alleen over HTTPS gestuurd, omdat een browser hem elders negeert. Achter een proxy die TLS beëindigt zet je `TrustForwardedProto`, zodat `X-Forwarded-Proto: https` meetelt, en alleen als een proxy die jij beheert die header zet. Zet `HSTSPreload` alleen aan als elk subdomein HTTPS spreekt: het is moeilijk terug te draaien.

Een handler kan voor zijn eigen antwoord een andere waarde zetten. De API-documentatie doet dat: Swagger UI laadt zijn code van een CDN, dus `/docs` draagt een beleid dat precies dat script toestaat en niets anders, terwijl de rest van de API het strenge beleid houdt.

## Cross-site request forgery

Een pagina op een andere site kan de browser van een bezoeker een request naar je API laten sturen, met de cookies van jouw site erbij. `gonestly.CrossOriginProtection` weigert dat: elk request dat iets wijzigt (niet GET, HEAD of OPTIONS) wordt beantwoord met **403 Forbidden** als de browser zegt dat het van een andere site komt. Hij kijkt naar de headers `Sec-Fetch-Site` en `Origin`, die browsers toevoegen en pagina's niet kunnen vervalsen, dus er is geen token om te beheren.

```go
gonestly.CrossOriginProtection("https://app.example.com")
```

Requests zonder die headers, zoals van curl, een mobiele app of een andere server, komen door: zij zijn niet de browser van een slachtoffer. Geef de origins van je eigen frontends op andere sites mee als vertrouwd; requests van dezelfde site en dezelfde origin hebben niets nodig.

Je hebt hem nodig als de API **cookies** accepteert. Een API die alleen een bearer-token in de `Authorization`-header neemt, heeft hem niet nodig, omdat een vervalst request het token niet kan toevoegen. Hij geeft bij het starten een panic voor een origin die geen schema en host is.

## Achter een proxy

Achter een load balancer of reverse proxy is het adres van elke verbinding de proxy. `gonestly.TrustProxies` vindt de client:

```go
gonestly.TrustProxies(1) // één proxy die jij beheert
```

Het getal is hoeveel proxy's voor de applicatie je beheert. Met één is de client het laatste adres in `X-Forwarded-For`, dat jouw proxy toevoegde; wat een client daarvoor schreef wordt genegeerd. Zet het nooit hoger dan het aantal proxy's dat je beheert, anders kunnen clients hun eigen adres kiezen.

Zodra het er is, geeft `gonestly.ClientIP(ctx)` de client, schrijft de [access-log](logging#de-access-log) hem als `remote_addr`, en telt [rate limiting](middleware#rate-limiting) erop. Een project van `gonestly new` leest het getal uit `TRUSTED_PROXIES`, standaard 0.
