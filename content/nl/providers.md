---
title: Providers
description: Providers zijn constructors waarvan Gonestly de resultaten in elkaar injecteert, met ondersteuning voor fouten, context en singletons.
---

Een provider is alles wat de applicatie bouwt en injecteert: een service, een repository, een client, een configuratiewaarde. In Gonestly is een provider een gewone constructorfunctie. De parameters zijn de afhankelijkheden, en het resultaat is wat de provider levert.

```go title="users/service.go"
type Service struct {
	repo   *Repository
	logger *slog.Logger
}

func NewService(repo *Repository, logger *slog.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}
```

Registreer hem in een module, en elke provider in die module kan om een `*Service` vragen:

```go
var Module = &gonestly.Module{
	Name:      "users",
	Providers: gonestly.Providers(NewRepository, NewService),
}
```

## Constructors

Een constructor mag zoveel parameters hebben als nodig en geeft een van deze twee vormen terug:

```go
func NewCache() *Cache                         // een waarde
func NewClient(cfg Config) (*Client, error)    // een waarde en een fout
```

Geeft een constructor een fout terug, dan start de applicatie niet. De fout wordt gemeld met de naam van de constructor en zijn module:

```text
gonestly: constructing database.Open in module "database": dial tcp 127.0.0.1:5432: connection refused
```

Een constructor die een panic geeft of nil teruggeeft, wordt op dezelfde manier gemeld. Een kapotte provider duikt dus nooit later op als nil-pointer op een andere plek.

Constructors mogen niet variadisch zijn en moeten een waarde teruggeven: een functie die alleen een fout teruggeeft, is geen provider.

## Singletons

Elke provider wordt precies één keer per applicatie gebouwd, in de volgorde van de afhankelijkheden, en overal waar hij nodig is wordt dezelfde instantie geïnjecteerd. Twee services die allebei om `*database.DB` vragen, krijgen dezelfde verbinding.

Gonestly bouwt bij het starten elke provider, ook als er nog niets van afhangt. Zo faalt een verkeerd ingestelde provider bij het opstarten, en niet pas bij het eerste request dat hem toevallig nodig heeft.

## De context injecteren

Een parameter van het type `context.Context` krijgt de context die aan `App.Start` of `App.Run` is meegegeven. Gebruik hem voor werk tijdens het bouwen, zoals verbinden met een database met een timeout:

```go
func Open(ctx context.Context, cfg Config) (*sql.DB, error) {
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	return db, db.PingContext(ctx)
}
```

> [!WARNING]
> Bewaar deze context niet voor werk op de achtergrond. Hij hoort bij het opstarten; start langlopend werk in [OnStart](lifecycle-events) en stop het in OnStop.

## Ingebouwde providers

Elke module kan deze injecteren zonder iets te importeren:

| Type                  | Wat het is                                                             |
| --------------------- | ---------------------------------------------------------------------- |
| `*slog.Logger`        | De logger van de applicatie, in te stellen met `gonestly.WithLogger`.  |
| `gonestly.Shutdowner` | Stopt de applicatie, bijvoorbeeld als een server faalt.                |
| `context.Context`     | De context van het opstarten, zie [hierboven](#de-context-injecteren). |

## Interfaces en waarden

Constructors geven meestal concrete types terug. Wil je een interface injecteren, registreer de constructor dan met `gonestly.As`. Voor een waarde die je al hebt, gebruik je `gonestly.Value`. Beide staan beschreven bij [eigen providers](custom-providers).

## Ontbrekende afhankelijkheden

Vraagt een constructor om een type dat in zijn module niet beschikbaar is, dan weigert de applicatie te starten. De melding legt uit waar het type wordt geleverd en wat je moet aanpassen:

```text
missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" provides it but does not export it: add it to the Exports of "database" and import that module
```

Gonestly herkent ook veelgemaakte fouten: vragen om `*Config` terwijl `Config` wordt geleverd, of vragen om een interface die een provider implementeert zonder dat hij met `As` is geregistreerd. Zie [foutmeldingen](error-messages).
