---
title: Lifecycle-events
description: Voer code uit als de applicatie start en stopt, sluit netjes af bij signalen en stop de applicatie vanuit een provider.
---

Een applicatie doorloopt drie fases: hij wordt **gebouwd**, waarbij de modulegraaf wordt gecontroleerd, hij **start**, waarbij elke provider wordt gebouwd en zijn starthooks draaien, en hij **stopt**, waarbij de stophooks in omgekeerde volgorde draaien.

```go
app, err := gonestly.New(AppModule) // bouwen: de modulegraaf controleren
if err != nil {
	log.Fatal(err)
}
if err := app.Run(context.Background()); err != nil { // starten, wachten op een signaal, stoppen
	log.Fatal(err)
}
```

## Start- en stophooks

Een provider die iets moet doen als de applicatie start, implementeert `gonestly.Starter`. Een provider die resources vasthoudt, implementeert `gonestly.Stopper`:

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

Gonestly controleert elke provider op deze interfaces; je hoeft niets te registreren.

## Volgorde

`OnStart` draait in de volgorde van de afhankelijkheden: een provider start nadat alles waarvan hij afhangt gestart is. `OnStop` draait in omgekeerde volgorde, dus een provider stopt vóór zijn afhankelijkheden. Een worker stopt vóór de queueclient die hij gebruikt, en de queueclient vóór de database.

> [!WARNING]
> Blokkeer niet in `OnStart`. Start langlopend werk in een goroutine, zoals in het voorbeeld, en stop het in `OnStop`.

## Als het starten faalt

Faalt een constructor of een `OnStart`-hook, dan stopt Gonestly elke provider die al gestart was, in omgekeerde volgorde, en geeft de fout terug. Een panic in een constructor of hook wordt op dezelfde manier een fout. Een half gestarte applicatie blijft dus nooit draaien.

## Run

`Run` gebruik je in `main`. Hij:

- start de applicatie,
- wacht tot de context wordt geannuleerd, het proces een interrupt (Ctrl+C) of stopsignaal krijgt, of een provider `Shutdown` aanroept,
- stopt de applicatie binnen de shutdown-timeout.

Na het eerste signaal geldt weer de standaardafhandeling van signalen: druk je nog een keer op Ctrl+C, dan stopt het proces direct.

## Shutdown-timeout

Stoppen krijgt standaard 10 seconden. Pas dat aan met een optie:

```go
app, err := gonestly.New(AppModule, gonestly.WithShutdownTimeout(30*time.Second))
```

De timeout gaat als deadline van de context mee naar elke `OnStop`-hook. Zijn de hooks na afloop nog niet klaar, dan geeft `Run` een fout terug in plaats van eindeloos te wachten.

## Stoppen vanuit een provider

Soms ontdekt een provider dat de applicatie niet verder kan, bijvoorbeeld als zijn HTTP-server faalt. Injecteer dan `gonestly.Shutdowner` en roep `Shutdown` aan:

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

`Run` stopt dan de applicatie en geeft die fout terug. Alleen de eerste aanroep van `Shutdown` telt.

## Zelf starten en stoppen

`Run` is een gemak rond `Start` en `Stop`. Die kun je ook zelf aanroepen, bijvoorbeeld in tests of in een command line tool:

```go
if err := app.Start(ctx); err != nil {
	return err
}
defer app.Stop(context.Background())
```

Een applicatie kan één keer gestart worden. `Stop` geeft de fouten van alle falende hooks samen terug, en doet niets als de applicatie niet draait.
