---
title: Logging
description: Gestructureerde logs met een request-ID op elke regel, een access-log die je kunt afstellen en een logger die je configureert vanuit de omgeving.
---

Gonestly logt met `log/slog` uit de standaardbibliotheek. Elke provider kan een `*slog.Logger` injecteren, en de applicatie bouwt hem één keer, dus er is één plek waar je bepaalt hoe logs eruitzien.

> [!NOTE]
> Contextbewuste logs, `LogAttrs`, `NewLogger` en de opties van de access-log zijn beschikbaar vanaf versie 0.4.0.

## De logger instellen

Een project van `gonestly new` leest twee instellingen uit de omgeving of `.env`:

| Instelling   | Waarden                          | Standaard |
| ------------ | -------------------------------- | --------- |
| `LOG_LEVEL`  | `debug`, `info`, `warn`, `error` | `info`    |
| `LOG_FORMAT` | `text`, `json`, `auto`           | `auto`    |

`auto` schrijft leesbare tekst naar een terminal en onder `gonestly dev`, en JSON naar al het andere, zoals de logverzamelaar van je server. Een verkeerde waarde laat de applicatie niet starten en zegt wat er mis was.

De code erachter is `gonestly.NewLogger`, die je zelf kunt aanroepen en aan de applicatie kunt geven:

```go title="main.go"
logger, err := gonestly.NewLogger(gonestly.LogOptions{Level: "debug", Format: "json"})
if err != nil {
	return err
}
application, err := gonestly.New(app.Module, gonestly.WithLogger(logger))
```

Elke andere `slog`-handler werkt ook: `WithLogger` neemt een `*slog.Logger`.

## Het request-ID op elke regel

De applicatie verpakt haar logger zo dat een regel die met de context van een request wordt gelogd het ID van dat request meekrijgt, welke code hem ook schrijft:

```go
func (s *Service) Charge(ctx context.Context, id int64) error {
	s.logger.InfoContext(ctx, "charging", "order", id)
	// level=INFO msg=charging order=42 request_id=3f1c...
	return s.gateway.Charge(ctx, id)
}
```

Geef de context van het request door, en gebruik de `Context`-methoden (`InfoContext`, `WarnContext`, `ErrorContext`). De database logt haar queries op dezelfde manier, dus een trage query in de debuglog leidt terug naar zijn request. Het ID komt uit de header `X-Request-ID` als een proxy of client een veilige stuurde, en is anders willekeurig; zie [middleware](middleware#request-ids-en-de-access-log).

## Details toevoegen

`gonestly.LogAttrs` voegt attributen toe aan elke regel over het request vanaf dat moment, ook aan de access-logregel die wordt geschreven als het request eindigt. Een guard is de natuurlijke plek om te zeggen wie er aanroept:

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

Nu zegt de regel die het request afsluit ook `user_id=...`. Eén regel per request die het hele verhaal vertelt is makkelijker te doorzoeken dan vijf regels die je aan elkaar moet knopen.

## De access-log

`gonestly.AccessLog` schrijft één regel per request zodra het beantwoord is:

```text
level=INFO msg=request method=GET path=/users/42 request_id=3f1c status=200 bytes=64 duration=1.2ms route=/users/{id} remote_addr=10.0.0.7 user_agent=curl/8.5
```

`route` is het patroon dat het request afhandelde, zodat je erop kunt groeperen zonder een ander pad voor elk id. `remote_addr` is het adres van de verbinding: achter een proxy is dat de proxy.

Twee opties houden hem bruikbaar:

```go
gonestly.AccessLog(logger,
	gonestly.SkipPaths("/health/*"),            // een load balancer vraagt het om de paar seconden
	gonestly.SlowAfter(500*time.Millisecond),   // tragere requests loggen op warn-niveau met slow=true
)
```

Een 5xx-status logt op errorniveau, een traag request op warn-niveau, al het andere op infoniveau.

## Achtergrondtaken

Een [achtergrondtaak](background-jobs) onthoudt het request dat hem in de wachtrij zette. Als hij draait, draagt zijn context hetzelfde request-ID, zodat de logs van het request en van het werk dat het startte met één zoekopdracht gevolgd kunnen worden.
