---
title: HTTP-server
description: Stel de HTTP-server in die je controllers serveert, met adres, timeouts en limieten, en lees hoe hij start en stopt.
---

Zodra een applicatie een [controller](controllers) heeft, serveert Gonestly hem met een HTTP-server uit `net/http`. Je hoeft zelf niets te starten: `app.Run` start hem en sluit hem netjes af.

## Lifecycle

De server start nadat elke provider gestart is, zodat een request nooit een provider bereikt die nog niet klaar is. Bij het afsluiten stopt hij als eerste: hij neemt geen nieuwe verbindingen meer aan en wacht, binnen de shutdown-timeout, op lopende requests voordat de providers stoppen.

Is het adres al in gebruik, dan faalt `Start` en stopt hij de providers die al gestart waren. Stopt de server onverwacht terwijl hij draait, dan sluit de applicatie af en geeft `Run` de fout terug.

## Configuratie

Lever een `gonestly.ServerConfig` in de rootmodule om de standaardwaarden aan te passen, meestal opgebouwd uit je [configuratie](configuration):

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

| Veld                | Standaard | Doel                                                                                                                          |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Addr`              | `:3000`   | Het adres waarop de server luistert.                                                                                          |
| `ReadHeaderTimeout` | 10s       | Tijd om de requestheaders te lezen.                                                                                           |
| `ReadTimeout`       | 30s       | Tijd om het hele request te lezen.                                                                                            |
| `WriteTimeout`      | 30s       | Tijd om het response te schrijven.                                                                                            |
| `IdleTimeout`       | 120s      | Hoe lang een keep-aliveverbinding stil mag zijn.                                                                              |
| `MaxBodyBytes`      | 1 MiB     | De grootste requestbody; grotere bodies krijgen 413. Een route kan [zijn eigen limiet](file-uploads#de-groottelimiet) zetten. |
| `Middleware`        | geen      | [Middleware](middleware) rond elk request.                                                                                    |
| `CORS`              | geen      | De [origins](#cors) die de API mogen aanroepen.                                                                               |
| `Guards`            | geen      | [Guards](guards) vóór elke route.                                                                                             |
| `Interceptors`      | geen      | [Interceptors](interceptors) rond elke route.                                                                                 |

De timeouts beschermen de server tegen trage clients; laat ze staan, tenzij je een reden hebt, zoals lange uploads.

## CORS

Een browser laat een pagina alleen een API op een andere origin aanroepen als de API dat toestaat. Dat geldt voor een frontend op een eigen domein, of op `localhost:4200` tijdens het ontwikkelen. Noem de origins van je frontends:

```go
func NewServerConfig(cfg Config) gonestly.ServerConfig {
	return gonestly.ServerConfig{
		CORS: gonestly.CORSConfig{AllowedOrigins: []string{"https://app.example.com"}},
	}
}
```

De server beantwoordt dan de preflightrequests van de browser en zet de CORS-headers op elk response, ook op fouten. Een project van `gonestly new` leest de origins uit `CORS_ORIGINS`, gescheiden door komma's.

| Veld               | Standaard                             | Doel                                                                     |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| `AllowedOrigins`   | geen                                  | De origins die de API mogen aanroepen. Zonder origins staat CORS uit.    |
| `AllowedMethods`   | GET, HEAD, POST, PUT, PATCH en DELETE | De methodes die een pagina mag gebruiken.                                |
| `AllowedHeaders`   | elke header                           | De requestheaders die een pagina mag sturen.                             |
| `ExposedHeaders`   | `X-Request-ID`                        | De responseheaders die een pagina mag lezen.                             |
| `AllowCredentials` | `false`                               | Laat de browser cookies en HTTP-authenticatie meesturen.                 |
| `MaxAge`           | 10 minuten                            | Hoe lang een browser het antwoord op een preflightrequest mag onthouden. |

Een origin is een schema en een host, zonder pad: `https://app.example.com`. `https://*.example.com` staat elk subdomein toe, wat past bij preview-omgevingen, en `*` staat elke origin toe, voor een openbare API.

Een fout wordt gemeld als de applicatie start: een origin met een pad of een slash aan het eind, of `AllowCredentials` samen met `*`, wat browsers weigeren.

> [!WARNING]
> CORS is geen toegangscontrole. Het vertelt browsers welke pagina's de responses mogen lezen; andere clients kunnen de API nog steeds aanroepen. Bescherm routes met [guards](guards).

## Automatisch een poort kiezen

Met poort 0 kiest het besturingssysteem een vrije poort. `app.Addr` vertelt welke:

```go
gonestly.ServerConfig{Addr: "127.0.0.1:0"}
// na Start:
fmt.Println(app.Addr()) // 127.0.0.1:52341
```

## Zelf de handler serveren

Om de applicatie vanuit je eigen server te serveren, of hem in een andere in te bouwen, bouw je hem zonder te luisteren en gebruik je zijn handler:

```go
app, err := gonestly.New(AppModule, gonestly.WithoutListener())
// na Start:
http.Handle("/api/", http.StripPrefix("/api", app.Handler()))
```

[Tests](testing) doen hetzelfde via het package `gonestlytest`.

## API-documentatie

De server serveert ook het [OpenAPI](openapi)-document op `/openapi.json` en Swagger UI op `/docs`. Stel ze in of zet ze uit met `gonestly.OpenAPIConfig`.

## De routes opvragen

`app.Routes` geeft elke route met zijn methode, pad en controller, bijvoorbeeld om ze bij het starten te tonen of in een test te controleren:

```go
for _, route := range app.Routes() {
	fmt.Println(route.Method, route.Path)
}
```
