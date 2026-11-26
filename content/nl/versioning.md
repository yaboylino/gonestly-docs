---
title: Versies
description: Draai meerdere versies van een API naast elkaar, laat clients kiezen met het pad of een header, en trek een versie in met waarschuwingen die clients kunnen lezen.
---

Een API waar mensen van afhankelijk zijn, mag niet onder hun voeten veranderen. Als een wijziging ze zou breken, publiceer je hem als nieuwe versie en laat je de oude werken totdat ze zijn overgestapt. Gonestly zet de versie in het pad, laat clients met een header kiezen als je dat liever hebt, en vertelt clients wanneer een versie op weg naar de uitgang is.

> [!NOTE]
> Versies zijn beschikbaar vanaf versie 0.4.0.

## Een versie registreren

`Router.Version` zet de routes erna onder een versie. Groepeer de routes van elke versie en zet de versie vóór de prefix:

```go title="internal/users/controller_v2.go"
func (c *ControllerV2) Routes(r *gonestly.Router) {
	r.Version("2").Prefix("/users")
	gonestly.Get(r, "", c.List)            // GET /v2/users
	gonestly.Get(r, "/{id}", c.Find)       // GET /v2/users/{id}
}
```

Een versie is een getal zoals `1` of `1.1`, met of zonder de `v`. Twee controllers, één per versie, kunnen in dezelfde module staan en dezelfde service delen: alleen het deel dat veranderde heeft een nieuwe handler en responstype nodig. Elk antwoord van een route met versie zegt welke versie antwoordde:

```text
API-Version: 2
```

Routes zonder versie, zoals de [health-checks](health-checks), blijven waar ze zijn.

## Kiezen met een header

Sommige teams willen schone paden en een header voor de versie. Zet het aan in de serverconfiguratie:

```go
gonestly.ServerConfig{
	Versioning: gonestly.VersioningConfig{Header: "API-Version", Default: "1"},
}
```

Nu wordt `GET /users` met `API-Version: 2` beantwoord door de routes van versie 2, en zonder de header door versie 1. Het pad met een versie, `/v2/users`, wint altijd van de header. Een header met een versie die niet bestaat krijgt **400 Bad Request** met een lijst van de versies die er wel zijn; een methode die een versie niet heeft krijgt zoals altijd 405.

`Default` is optioneel. Zonder bereikt een pad zonder versie alleen routes die geen versie hebben, en moet een client zeggen welke hij wil. Zet je `Default` op een versie zonder routes, dan start de applicatie niet.

## Een versie intrekken

Vertel clients het voordat je iets verwijdert. `Deprecate` markeert elke route erna, en de opties zeggen wanneer en wat het vervangt:

```go
r.Version("1").Deprecate(
	gonestly.DeprecatedSince(time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)),
	gonestly.SunsetAt(time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)),
	gonestly.SuccessorAt("/v2/users"),
).Prefix("/users")
```

Elk antwoord van die routes draagt dan:

```text
Deprecation: @1772323200
Sunset: Thu, 31 Dec 2026 00:00:00 GMT
Link: </v2/users>; rel="successor-version"
```

Dit zijn de headers van RFC 9745 en RFC 8594, die API-clients en gateways kunnen lezen, zodat ze hun ontwikkelaars lang voor de datum kunnen waarschuwen. Het OpenAPI-document markeert de routes als deprecated en zegt in hun beschrijving wanneer ze ophouden te werken.

Gebruik voor één route de optie: `gonestly.Deprecated(gonestly.SunsetAt(date))`. `gonestly.Deprecated()` zonder opties markeert alleen het OpenAPI-document.

De sunset-datum is informatie, geen schakelaar: de route blijft na die datum werken. Als de datum voorbij is en je logs geen verkeer meer tonen, verwijder je de versie, met zijn controller en tests, zoals elke verwijderde feature.

## Documentatie per versie

Het OpenAPI-document van de hele API toont elke versie. Elke versie heeft ook een eigen document, om een client mee te genereren:

```text
/openapi.json            elke versie
/openapi.json?version=2  alleen /v2-routes
```

De documentatiepagina op `/docs` krijgt een keuzelijst om tussen ze te wisselen.
