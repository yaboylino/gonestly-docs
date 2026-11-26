---
title: Achtergrondtaken
description: Voer werk buiten het request uit, probeer het opnieuw als het mislukt en plan het met cron, vanuit de database die je al hebt.
---

Sommig werk hoort niet in een request: een e-mail versturen, een afbeelding verkleinen, een trage API aanroepen, een nachtelijke opruiming. Een **job** is een benoemde functie met een payload. Jij zet hem in de wachtrij, en een worker voert hem later uit, probeert hem opnieuw als hij mislukt en bewaart hem over herstarts heen.

Jobs staan in je database, dus er is niets anders om te draaien. Ze overleven een crash, ze draaien één keer ongeacht hoeveel instanties je start, en een job die binnen een [transactie](transactions) in de wachtrij komt, bestaat alleen als die transactie slaagt. Dat laatste is het transactional outbox patroon, zonder extra werk.

> [!NOTE]
> Achtergrondtaken zijn beschikbaar vanaf versie 0.4.0.

## Jobs toevoegen

Draai in een project met een [database](database):

```sh
gonestly add jobs
```

Het schrijft een migratie die de tabel `gonestly_jobs` maakt voor jouw database, en voegt de module toe aan de rootmodule:

```go title="internal/app/module.go"
Imports: gonestly.Imports(
	sql.ModuleFunc(...),
	jobs.Module(jobs.Options{}),
),
```

Zonder de CLI maak je de tabel met de SQL uit `jobs.Migration("postgres")` (of `"mysql"`, `"sqlite"`) en importeer je de module zelf.

## Een job definiëren

Definieer een job in de constructor van de provider die het werk bezit. `Define` registreert de handler en geeft een getypeerde `Job` terug om mee in de wachtrij te zetten:

```go title="internal/mail/service.go"
type Welcome struct {
	UserID int64 `json:"userId"`
}

type Service struct {
	welcome *jobs.Job[Welcome]
}

func NewService(q *jobs.Queue, mailer *Mailer) (*Service, error) {
	s := &Service{}
	var err error
	s.welcome, err = jobs.Define(q, "welcome-mail", func(ctx context.Context, w Welcome) error {
		return mailer.SendWelcome(ctx, w.UserID)
	}, jobs.MaxAttempts(5))
	return s, err
}

func (s *Service) SendWelcome(ctx context.Context, userID int64) error {
	_, err := s.welcome.Enqueue(ctx, Welcome{UserID: userID})
	return err
}
```

De payload wordt als JSON opgeslagen. Een job draait **minstens één keer**: als een proces halverwege sterft, of het resultaat niet geschreven kan worden, draait de job opnieuw. Schrijf handlers zo dat twee keer draaien geen kwaad kan, bijvoorbeeld door te controleren of de e-mail al is verstuurd.

## In de wachtrij zetten

`Enqueue` geeft het id van de job terug. Opties veranderen één run:

| Optie                   | Effect                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `jobs.Delay(time.Hour)` | Wacht zo lang voordat de job kan draaien.                                          |
| `jobs.At(t)`            | Wacht tot dit moment.                                                              |
| `jobs.Unique("key")`    | Eén job met deze sleutel tegelijk; een tweede `Enqueue` geeft `jobs.ErrDuplicate`. |
| `jobs.Priority(10)`     | Een hoger getal draait eerst.                                                      |
| `jobs.MaxAttempts(n)`   | Pogingen voor deze run in plaats van de standaard van de job.                      |

Zet een job in een transactie in de wachtrij om hem aan je data te koppelen:

```go
err := db.Transaction(ctx, func(ctx context.Context) error {
	user, err := users.Create(ctx, &User{Email: email})
	if err != nil {
		return err
	}
	_, err = s.welcome.Enqueue(ctx, Welcome{UserID: user.ID})
	return err
})
```

Mislukt het aanmaken van de gebruiker, dan bestaat er geen e-mailjob. Kan de job niet worden opgeslagen, dan wordt er geen gebruiker gemaakt.

## Fouten en nieuwe pogingen

Een handler die een fout teruggeeft wordt opnieuw geprobeerd, tot `MaxAttempts` (standaard 3), met een groeiende wachttijd: 10 seconden, steeds verdubbelend tot een uur, met wat willekeur zodat nieuwe pogingen niet tegelijk komen. Pas het per job aan:

```go
jobs.Define(q, "export", run,
	jobs.MaxAttempts(8),
	jobs.Timeout(10*time.Minute),
	jobs.Backoff(func(attempt int) time.Duration { return time.Duration(attempt) * time.Minute }),
)
```

- **Timeout:** de context van de handler eindigt na `Timeout` (standaard 5 minuten). Houd er rekening mee.
- **Panics:** een panic wordt opgevangen en telt als mislukte poging, met de stack in de fout.
- **Permanente fouten:** geef `jobs.Permanent(err)` terug als opnieuw proberen niet helpt, zoals bij een payload die nergens op slaat. De job mislukt dan meteen.
- **Opgegeven:** een job zonder pogingen over krijgt de status `failed` en bewaart zijn laatste fout. Zie [inspecteren](#inspecteren).

In een handler geeft `jobs.Current(ctx)` het id, de poging en het maximum.

## Plannen

`Schedule` zet een job volgens een cronschema in de wachtrij:

```go
s.cleanup, err = jobs.Define(q, "cleanup", s.run)
if err != nil {
	return nil, err
}
err = s.cleanup.Schedule("0 3 * * *", Cleanup{OlderThan: 30})
```

De vijf velden zijn minuut, uur, dag van de maand, maand en dag van de week, met `*`, lijsten (`1,15`), bereiken (`mon-fri`), stappen (`*/10`) en de namen van maanden en dagen. `@hourly`, `@daily`, `@weekly`, `@monthly` en `@yearly` zijn afkortingen, en `@every 5m` draait met een vast interval. De tijdzone is `Options.Location`, standaard UTC.

Elke instantie die een job plant, probeert elke run in de wachtrij te zetten, en de database laat er maar één slagen. De job draait dus één keer per moment, hoeveel instanties je ook draait, zonder dat er een leider gekozen hoeft te worden. Een run die gemist wordt omdat alle instanties uit stonden, wordt niet ingehaald.

## Wachtrijen en schalen

Draai meer instanties om meer jobs te draaien: workers pakken jobs zonder dezelfde twee keer te pakken, op PostgreSQL en MySQL met `SKIP LOCKED` en op SQLite met één statement.

- **Gelijktijdigheid:** `Options.Concurrency` jobs draaien tegelijk in één proces (standaard 4).
- **Wachtrijen:** zet een job op een benoemde wachtrij met `jobs.OnQueue("emails")`, en geef een proces `Options.Queues` om alleen aan sommige wachtrijen te werken, zodat traag werk snel werk niet kan uithongeren.
- **Alleen in de wachtrij zetten:** `Options.EnqueueOnly` zet draaien en plannen uit in een proces, voor instanties die alleen jobs aanmaken.
- **Handlers:** een proces draait alleen de jobs waarvoor het een handler heeft, dus je kunt verschillende sets jobs in verschillende processen draaien.

## Stoppen

Als de applicatie stopt, pakt de worker geen nieuwe jobs meer en wacht hij op de lopende tot de shutdown-timeout. Een job die dan nog draait, wordt geannuleerd en teruggezet zonder een poging te verbruiken, zodat een ander proces hem draait. Een proces dat zonder waarschuwing wordt gestopt, laat zijn jobs vergrendeld tot hun timeout voorbij is, waarna een ander proces ze overneemt.

## Inspecteren

```go
stats, _ := q.Stats(ctx)            // pending, running, done en failed
failed, _ := q.Failed(ctx, 20)      // wat zonder pogingen kwam te zitten, met de laatste fout
err := q.Retry(ctx, failed[0].ID)   // een nieuwe set pogingen, vanaf nu
```

Afgeronde jobs worden na `Options.Retention` (7 dagen) verwijderd, en mislukte na `Options.FailedRetention` (30 dagen). Een `Unique`-sleutel kan opnieuw gebruikt worden als zijn job weg is.

## Testen

Zet jobs in een test in de wachtrij en roep `RunDue` aan om alles uit te voeren wat aan de beurt is, in de huidige goroutine, zonder de worker te starten:

```go
n, err := queue.RunDue(ctx)
```

Het draait jobs die nu aan de beurt zijn; een job met een `Delay` of een backoff wacht zoals in productie.

## Opties

| Optie             | Standaard   | Betekenis                                                          |
| ----------------- | ----------- | ------------------------------------------------------------------ |
| `Concurrency`     | 4           | Jobs die tegelijk draaien in dit proces.                           |
| `PollInterval`    | 1s          | Hoe vaak de database om jobs gevraagd wordt die aan de beurt zijn. |
| `Queues`          | alle        | De wachtrijen waaraan dit proces werkt.                            |
| `EnqueueOnly`     | false       | Geen jobs draaien of plannen in dit proces.                        |
| `Retention`       | 7 dagen     | Hoe lang afgeronde jobs bewaard blijven.                           |
| `FailedRetention` | 30 dagen    | Hoe lang mislukte jobs bewaard blijven.                            |
| `Location`        | UTC         | De tijdzone van cron-expressies.                                   |
| `WorkerID`        | gegenereerd | Benoemt dit proces in de tabel.                                    |
