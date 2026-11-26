---
title: Events
description: Let one part of the application announce what happened and others react, without the first knowing about them.
---

When a user signs up, the users module should not have to know about the mailer, the audit log and the analytics. It announces that a user was created, and whoever cares reacts. That is what the event bus is for: the parts stay independent, and a new reaction is a new subscription instead of a change in the code that started it.

> [!NOTE]
> Events are available from version 0.4.0.

## Publishing and subscribing

Every module can inject the `*gonestly.EventBus`. An event is any value; its type is what subscribers choose on.

```go title="internal/users/events.go"
type UserCreated struct {
	ID    int64
	Email string
}
```

Publish from the code that made it happen:

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

Subscribe in the constructor of the provider that reacts, so the subscription exists before the application starts:

```go title="internal/mail/service.go"
func NewService(bus *gonestly.EventBus, mailer *Mailer) *Service {
	s := &Service{mailer: mailer}
	gonestly.Subscribe(bus, func(ctx context.Context, e users.UserCreated) error {
		return s.mailer.SendWelcome(ctx, e.Email)
	})
	return s
}
```

## What a publish does

`Publish` runs the handlers of the event type in the order they subscribed, **before it returns**, in the goroutine and with the context of the publisher. Two things follow:

- **Transactions:** a handler runs in the transaction of the context. If it writes to the database and fails, and the publisher returns the error, everything rolls back together.
- **Errors:** every handler runs, even when one fails, and the errors come back joined, so `Publish` returns an error when any handler failed. A panic in a handler becomes an error too.

An event without subscribers is fine. A nil event is an error.

## Async handlers

Some reactions must not slow the request down or fail it, such as sending a notification. Subscribe with `gonestly.Async()`:

```go
gonestly.Subscribe(bus, s.onUserCreated, gonestly.Async())
```

An async handler runs in its own goroutine. The publisher does not wait for it and does not see its error: the error is logged. The handler gets the values of the context of the publisher, such as the [request ID](logging), but it is not canceled when the request ends. When the application stops, it waits for the handlers that are still running.

## Types

Subscribers match on the type of the published value. A value and a pointer to it are different types: publish `UserCreated{}` and subscribe to `UserCreated`, and do not mix them.

An interface works as a filter for a family of events. Every event that implements it arrives:

```go
type Auditable interface{ AuditEntry() string }

gonestly.Subscribe(bus, func(ctx context.Context, e Auditable) error {
	return audit.Write(ctx, e.AuditEntry())
})
```

`Subscribe` returns a function that removes the subscription again.

## Events or jobs

Events stay in the process and are not stored. If the application stops between the publish and the reaction, an async reaction is lost, and nothing is retried.

| You want                                                      | Use                                 |
| ------------------------------------------------------------- | ----------------------------------- |
| To react in the same request, in the same transaction         | `Publish` with a normal handler     |
| To react without slowing the request, losing it is acceptable | `Publish` with `Async()`            |
| Work that must happen, survive a restart and be retried       | a [background job](background-jobs) |

They combine well: a normal handler can enqueue a job in the transaction of the request, so the reaction is both decoupled and guaranteed.

## Testing

The bus is an ordinary provider, so a test publishes an event and looks at the effect. Handlers that are not async have run when `Publish` returns, so there is nothing to wait for:

```go
err := bus.Publish(ctx, users.UserCreated{ID: 1, Email: "ada@example.com"})
```
