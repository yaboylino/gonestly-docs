---
title: Events
description: Laat het ene deel van de applicatie aankondigen wat er gebeurd is en anderen reageren, zonder dat het eerste ze kent.
---

Als een gebruiker zich aanmeldt, hoort de users-module niets te hoeven weten van de mailer, het auditlog en de analytics. Ze kondigt aan dat een gebruiker is aangemaakt, en wie het aangaat reageert. Daar dient de event-bus voor: de delen blijven onafhankelijk, en een nieuwe reactie is een nieuw abonnement in plaats van een wijziging in de code die het startte.

> [!NOTE]
> Events zijn beschikbaar vanaf versie 0.4.0.

## Publiceren en abonneren

Elke module kan de `*gonestly.EventBus` injecteren. Een event is elke waarde; het type is waarop abonnees kiezen.

```go title="internal/users/events.go"
type UserCreated struct {
	ID    int64
	Email string
}
```

Publiceer vanuit de code die het deed gebeuren:

```go title="internal/users/service.go"
func (s *Service) Create(ctx context.Context, email string) (*User, error) {
	user, err := s.repo.Create(ctx, &User{Email: email})
	if err != nil {
		return nil, err
	}
	if err := s.bus.Publish(ctx, UserCreated{ID: user.ID, Email: user.Email}); err != nil {
		return nil, err
	}
	return user, nil
}
```

Abonneer in de constructor van de provider die reageert, zodat het abonnement bestaat voordat de applicatie start:

```go title="internal/mail/service.go"
func NewService(bus *gonestly.EventBus, mailer *Mailer) *Service {
	s := &Service{mailer: mailer}
	gonestly.Subscribe(bus, func(ctx context.Context, e users.UserCreated) error {
		return s.mailer.SendWelcome(ctx, e.Email)
	})
	return s
}
```

## Wat een publicatie doet

`Publish` voert de handlers van het eventtype uit in de volgorde waarin ze zich abonneerden, **voordat hij terugkeert**, in de goroutine en met de context van de publisher. Daaruit volgt:

- **Transacties:** een handler draait in de transactie van de context. Schrijft hij naar de database en mislukt hij, en geeft de publisher de fout terug, dan rolt alles samen terug.
- **Fouten:** elke handler draait, ook als er een mislukt, en de fouten komen samengevoegd terug, dus `Publish` geeft een fout als een handler mislukte. Een panic in een handler wordt ook een fout.

Een event zonder abonnees is prima. Een nil-event is een fout.

## Async handlers

Sommige reacties mogen het request niet vertragen of laten mislukken, zoals een notificatie versturen. Abonneer met `gonestly.Async()`:

```go
gonestly.Subscribe(bus, s.onUserCreated, gonestly.Async())
```

Een async handler draait in een eigen goroutine. De publisher wacht er niet op en ziet zijn fout niet: de fout wordt gelogd. De handler krijgt de waarden van de context van de publisher, zoals het [request-ID](logging), maar wordt niet geannuleerd als het request eindigt. Als de applicatie stopt, wacht ze op de handlers die nog draaien.

## Types

Abonnees matchen op het type van de gepubliceerde waarde. Een waarde en een pointer ernaar zijn verschillende types: publiceer `UserCreated{}` en abonneer op `UserCreated`, en meng ze niet.

Een interface werkt als filter voor een familie van events. Elk event dat hem implementeert komt aan:

```go
type Auditable interface{ AuditEntry() string }

gonestly.Subscribe(bus, func(ctx context.Context, e Auditable) error {
	return audit.Write(ctx, e.AuditEntry())
})
```

`Subscribe` geeft een functie terug die het abonnement weer verwijdert.

## Events of jobs

Events blijven in het proces en worden niet opgeslagen. Stopt de applicatie tussen de publicatie en de reactie, dan gaat een async reactie verloren en wordt niets opnieuw geprobeerd.

| Je wilt                                                          | Gebruik                                |
| ---------------------------------------------------------------- | -------------------------------------- |
| Reageren in hetzelfde request, in dezelfde transactie            | `Publish` met een gewone handler       |
| Reageren zonder het request te vertragen, verlies mag            | `Publish` met `Async()`                |
| Werk dat moet gebeuren, een herstart overleeft en herhaald wordt | een [achtergrondtaak](background-jobs) |

Ze combineren goed: een gewone handler kan in de transactie van het request een job in de wachtrij zetten, zodat de reactie zowel ontkoppeld als gegarandeerd is.

## Testen

De bus is een gewone provider, dus een test publiceert een event en kijkt naar het effect. Handlers die niet async zijn, hebben gedraaid als `Publish` terugkeert, dus er valt niets op te wachten:

```go
err := bus.Publish(ctx, users.UserCreated{ID: 1, Email: "ada@example.com"})
```
