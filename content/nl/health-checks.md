---
title: Health-checks
description: Laat load balancers en orchestrators weten of de applicatie draait en requests kan afhandelen, inclusief de database.
---

Wie verkeer naar je applicatie stuurt, zoals een load balancer, Docker of Kubernetes, wil twee dingen weten: draait hij, en kan hij nu requests afhandelen. Een project van `gonestly new` beantwoordt beide:

| Route               | Antwoordt 200 als                                               | Gebruik hem om                             |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `GET /health/live`  | de applicatie draait                                            | een applicatie die vastloopt te herstarten |
| `GET /health/ready` | alles wat hij nodig heeft werkt, en hij niet aan het stoppen is | te bepalen of hij verkeer mag krijgen      |

```json
{ "status": "ok", "checks": { "sql.DB": "ok" } }
```

Faalt een check, dan antwoordt `/health/ready` met **503 Service Unavailable** en noemt hij de check. Waarom hij faalde wordt gelogd, niet verstuurd, omdat de oorzaak interne details kan bevatten, zoals een hostnaam.

## Wat er wordt gecontroleerd

Elke provider die `gonestly.HealthChecker` implementeert doet mee. De [database](database) doet dat: hij pingt de verbinding. Geef je eigen provider een check met één methode:

```go title="search/client.go"
func (c *Client) CheckHealth(ctx context.Context) error {
	return c.ping(ctx)
}
```

De checks draaien tegelijk. Respecteer de context: die eindigt als het request te lang duurt.

## De controller

De routes zijn een gewone [controller](controllers) in je project, gebouwd op `gonestly.Health`, dat elke module kan injecteren:

```go title="internal/health/controller.go"
func (c *Controller) Routes(r *gonestly.Router) {
	r.Prefix("/health")
	gonestly.Get(r, "/live", c.Live)
	gonestly.Get(r, "/ready", c.Ready)
}

func (c *Controller) Ready(ctx context.Context, _ gonestly.Empty) (gonestly.HealthReport, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	report := c.health.Report(ctx)
	return report, report.Err()
}
```

`report.Err()` is nil voor een gezonde applicatie en anders een 503. Omdat de controller van jou is, kun je de paden aanpassen of de routes beschermen met een [guard](guards).

## Deployen zonder verloren requests

Krijgt de applicatie een stopsignaal, dan antwoordt `/health/ready` meteen met 503. Met een shutdown-vertraging blijft de server nog even requests afhandelen, zodat de load balancer het merkt en nieuwe requests ergens anders heen stuurt voordat de server sluit:

```go title="main.go"
application, err := gonestly.New(app.Module, gonestly.WithShutdownDelay(5*time.Second))
```

Na de vertraging [stopt de applicatie netjes](lifecycle-events): lopende requests worden afgemaakt, daarna stoppen de providers. Kies een vertraging die iets langer is dan het interval waarmee je load balancer de readiness controleert.
