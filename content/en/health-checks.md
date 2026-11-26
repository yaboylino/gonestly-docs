---
title: Health checks
description: Tell load balancers and orchestrators whether the application runs and can handle requests, with the database included.
---

Whoever sends traffic to your application, such as a load balancer, Docker or Kubernetes, wants to know two things: does it run, and can it handle requests right now. A project made with `gonestly new` answers both:

| Route               | Answers 200 when                                  | Use it for                              |
| ------------------- | ------------------------------------------------- | --------------------------------------- |
| `GET /health/live`  | the application runs                              | restarting an application that hangs    |
| `GET /health/ready` | everything it needs works, and it is not stopping | deciding whether it may receive traffic |

```json
{ "status": "ok", "checks": { "sql.DB": "ok" } }
```

When a check fails, `/health/ready` answers **503 Service Unavailable** and names the check. Why it failed is logged, not sent, because the cause may hold internal details such as a host name.

## What is checked

Every provider that implements `gonestly.HealthChecker` takes part. The [database](database) does: it pings the connection. Add a check to your own provider with one method:

```go title="search/client.go"
func (c *Client) CheckHealth(ctx context.Context) error {
	return c.ping(ctx)
}
```

The checks run at the same time. Honor the context: it ends when the request takes too long.

## The controller

The routes are an ordinary [controller](controllers) in your project, built on `gonestly.Health`, which every module can inject:

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

`report.Err()` is nil for a healthy application and a 503 otherwise. Because the controller is yours, you can change the paths or protect the routes with a [guard](guards).

## Deploying without dropped requests

When the application receives a stop signal, `/health/ready` starts answering 503 straight away. With a shutdown delay the server keeps handling requests for a moment, so the load balancer notices and sends new requests elsewhere before the server closes:

```go title="main.go"
application, err := gonestly.New(app.Module, gonestly.WithShutdownDelay(5*time.Second))
```

After the delay the application [stops gracefully](lifecycle-events): running requests finish, then the providers stop. Choose a delay a little longer than the interval at which your load balancer checks readiness.
