---
title: Testing
description: Test modules in isolation by overriding providers with fakes and resolving providers from a running application.
---

Because every dependency is injected, testing a Gonestly module comes down to building the module with a few providers replaced. You use the standard `testing` package; there is no special test runner.

## A module test

Build the module you want to test, replace what talks to the outside world, start it and resolve the provider under test:

```go title="users/service_test.go"
func TestServiceFindsUser(t *testing.T) {
	store := &fakeStore{users: map[string]*User{"42": {ID: "42", Name: "Ada"}}}

	app, err := gonestly.New(Module,
		gonestly.Override(gonestly.Value[Store](store)),
		gonestly.WithLogger(slog.New(slog.DiscardHandler)),
	)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = app.Stop(context.Background()) })

	service, err := gonestly.Resolve[*Service](app)
	if err != nil {
		t.Fatal(err)
	}
	user, err := service.Find(t.Context(), "42")
	// ...
}
```

## Overrides

`gonestly.Override` replaces the provider of the same type in whichever module declares it. It accepts constructors and providers, just like `Providers`:

```go
gonestly.Override(
	gonestly.Value[Store](fakeStore),
	NewFakeMailer, // replaces the provider of *Mailer
)
```

An override that matches no provider is reported as an error, so a renamed type never silently disables a fake.

## Resolve

`gonestly.Resolve[T]` returns the provider of type `T` from the root module of a started application: its own providers and the exports of its imports. It returns `gonestly.ErrNotStarted` before `Start`.

## A quiet logger

The application logs when it starts and stops. Pass a logger that discards everything to keep test output clean:

```go
gonestly.WithLogger(slog.New(slog.DiscardHandler))
```

## Testing the wiring

Building an application already validates the whole module graph. A test that only calls `gonestly.New` on your root module catches missing imports and exports in CI, without starting anything:

```go title="main_test.go"
func TestModuleGraph(t *testing.T) {
	if _, err := gonestly.New(AppModule); err != nil {
		t.Fatal(err)
	}
}
```
