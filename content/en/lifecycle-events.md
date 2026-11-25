---
title: Lifecycle events
description: Run code when the application starts and stops, shut down gracefully on signals and stop the application from a provider.
---

An application goes through three phases: it is **built**, which validates the module graph, it **starts**, which constructs every provider and runs their start hooks, and it **stops**, which runs their stop hooks in reverse order.

```go
app, err := gonestly.New(AppModule) // build: validate the module graph
if err != nil {
	log.Fatal(err)
}
if err := app.Run(context.Background()); err != nil { // start, wait for a signal, stop
	log.Fatal(err)
}
```

## Start and stop hooks

A provider that needs to do work when the application starts implements `gonestly.Starter`. A provider that holds resources implements `gonestly.Stopper`:

```go title="worker/worker.go"
type Worker struct {
	jobs   *queue.Client
	cancel context.CancelFunc
	done   chan struct{}
}

func (w *Worker) OnStart(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(context.Background())
	w.cancel, w.done = cancel, make(chan struct{})
	go w.run(runCtx)
	return nil
}

func (w *Worker) OnStop(ctx context.Context) error {
	w.cancel()
	select {
	case <-w.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
```

Gonestly checks every provider for these interfaces; there is nothing to register.

## Order

`OnStart` runs in dependency order: a provider starts after everything it depends on has started. `OnStop` runs in the reverse order, so a provider stops before its dependencies do. A worker stops before the queue client it uses, and the queue client before the database.

> [!WARNING]
> Do not block in `OnStart`. Start long running work in a goroutine, as in the example, and stop it in `OnStop`.

## When starting fails

If a constructor or an `OnStart` hook fails, Gonestly stops every provider that already started, in reverse order, and returns the error. A panic in a constructor or a hook is turned into an error the same way, so a half started application never keeps running.

## Run

`Run` is what you use in `main`. It:

- starts the application,
- waits until the context is canceled, the process receives an interrupt (Ctrl+C) or a termination signal, or a provider calls `Shutdown`,
- stops the application within the shutdown timeout.

After the first signal, the default signal handling is restored: pressing Ctrl+C a second time terminates the process immediately.

## Shutdown timeout

Stopping gets 10 seconds by default. Change it with an option:

```go
app, err := gonestly.New(AppModule, gonestly.WithShutdownTimeout(30*time.Second))
```

The timeout is passed to every `OnStop` hook as the context deadline. If the hooks have not finished when it expires, `Run` returns an error instead of waiting forever.

## Stopping from a provider

Sometimes a provider discovers that the application cannot continue, for example when its HTTP server fails. Inject `gonestly.Shutdowner` and call `Shutdown`:

```go
func (s *Server) OnStart(ctx context.Context) error {
	go func() {
		if err := s.http.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			s.shutdowner.Shutdown(err)
		}
	}()
	return nil
}
```

`Run` then stops the application and returns that error. Only the first call to `Shutdown` has effect.

## Starting and stopping yourself

`Run` is a convenience around `Start` and `Stop`, which you can call yourself, for example in tests or in a command line tool:

```go
if err := app.Start(ctx); err != nil {
	return err
}
defer app.Stop(context.Background())
```

An application can be started once. `Stop` returns the errors of every failing hook together, and does nothing if the application is not running.
