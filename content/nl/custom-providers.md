---
title: Eigen providers
description: Lever interfaces met As, bestaande waarden met Value, en deel één instantie onder twee types met Alias.
---

De meeste providers zijn constructors die je met `gonestly.Providers` registreert. Voor de andere gevallen heeft Gonestly drie bouwstenen: `As`, `Value` en `Alias`. Elk geeft een `gonestly.Provider` terug die je net als een constructor aan `Providers` meegeeft.

## Interfaces met As

Constructors in Go geven concrete types terug, maar wie ze gebruikt, hangt vaak af van een interface. `As` registreert een constructor onder een interface die hij implementeert:

```go title="users/module.go"
type Store interface {
	Find(ctx context.Context, id string) (*User, error)
}

type PostgresStore struct{ db *sql.DB }

func NewPostgresStore(db *sql.DB) *PostgresStore { return &PostgresStore{db: db} }

var Module = &gonestly.Module{
	Name: "users",
	Providers: gonestly.Providers(
		gonestly.As[Store](NewPostgresStore),
		NewService, // func NewService(store Store) *Service
	),
}
```

`NewService` krijgt nu een `Store`, en buiten de module weet niemand van `PostgresStore`. Implementeert het resultaat van de constructor de interface niet, dan weigert de applicatie te starten.

> [!HINT]
> Vergeet je `As` en registreer je `NewPostgresStore` direct, dan wijst de foutmelding je erop: `*users.PostgresStore implements it: provide it with gonestly.As[users.Store](users.NewPostgresStore)`.

## Bestaande waarden met Value

`Value` levert een waarde die je al hebt, zoals een client die vóór de applicatie is gemaakt:

```go
client := stripe.NewClient(apiKey)

var Module = &gonestly.Module{
	Name:      "billing",
	Providers: gonestly.Providers(gonestly.Value(client)),
}
```

Het type komt van het argument. Geef het type expliciet mee om de waarde als interface te leveren:

```go
gonestly.Value[users.Store](memoryStore)
```

Een nil-waarde wordt geweigerd. Waarden draaien hun [lifecycle-hooks](lifecycle-events) zoals elke andere provider, dus een waarde die `OnStop` implementeert, stopt mee met de applicatie.

Een waarde heeft geen constructor; exporteer hem daarom via zijn type: `gonestly.Exports(gonestly.Type[*stripe.Client]())`.

## Eén instantie, twee types met Alias

Soms moet dezelfde instantie beschikbaar zijn als concreet type én als interface. De constructor twee keer registreren zou hem twee keer bouwen. `Alias` levert in plaats daarvan de bestaande instantie onder een tweede type:

```go
var Module = &gonestly.Module{
	Name: "users",
	Providers: gonestly.Providers(
		NewPostgresStore,
		gonestly.Alias[Store, *PostgresStore](),
	),
}
```

Providers die om `Store` vragen en providers die om `*PostgresStore` vragen, krijgen dezelfde instantie, en de lifecycle-hooks draaien één keer.

## Eigen providers exporteren

Geef de providerwaarde aan `Exports` mee, of exporteer het type:

```go
store := gonestly.As[Store](NewPostgresStore)

var Module = &gonestly.Module{
	Name:      "users",
	Providers: []gonestly.Provider{store},
	Exports:   gonestly.Exports(store), // of gonestly.Type[Store]()
}
```

Hoort één constructor bij twee providers, bijvoorbeeld een keer direct en een keer via `As`, dan is het exporteren van die constructor dubbelzinnig. Gonestly meldt dat en vraagt je met `gonestly.Type` te exporteren.
