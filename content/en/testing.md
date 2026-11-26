---
title: Testing
description: Test modules in isolation by overriding providers with fakes and resolving providers from a running application.
---

Because every dependency is injected, testing a Gonestly module comes down to building the module with a few providers replaced. You use the standard `testing` package; there is no special test runner, and HTTP tests do not need a running server.

## Testing controllers

The `gonestlytest` package starts a module without opening a port, stops it when the test ends and sends requests straight to its handler:

```go title="users/controller_test.go"
func TestCreateUser(t *testing.T) {
	app := gonestlytest.Start(t, users.Module, gonestly.Override(gonestly.Value[users.Store](newFakeStore())))

	var created users.User
	app.Post("/users", map[string]string{"name": "Ada"}).ExpectStatus(http.StatusCreated).JSON(&created)

	problem := app.Post("/users", map[string]string{}).Problem()
	if problem.Status != http.StatusBadRequest || problem.Errors[0].Field != "name" {
		t.Errorf("unexpected problem: %+v", problem)
	}
}
```

| Helper                                        | Purpose                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app.Get`, `Post`, `Put`, `Patch`, `Delete`   | Send a request; bodies are encoded as JSON. Extra arguments are header name and value pairs. |
| `app.Request(method, path, body, headers...)` | Send any request; a string, `[]byte` or `io.Reader` body is sent as it is.                   |
| `res.ExpectStatus(code)`                      | Fail the test, showing the body, if the status differs.                                      |
| `res.JSON(&v)`                                | Decode the body.                                                                             |
| `res.Problem()`                               | Decode an error response into `gonestly.Problem`.                                            |
| `gonestlytest.Resolve[T](app)`                | Get a provider, failing the test if it is missing.                                           |

`Start` uses a silent logger; options such as `gonestly.Override` are applied on top.

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

## Testing with a database

Repositories and queries run against a real database, so test them against one. SQLite in a temporary file needs no server and runs your migrations in milliseconds:

```go title="users/repository_test.go"
func TestRepository(t *testing.T) {
	db, err := sql.Open(t.Context(), sql.Options{Driver: "sqlite", DSN: "file:" + t.TempDir() + "/test.db"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	migrator, err := sql.NewMigrator(db, migrations.Files)
	if err == nil {
		_, err = migrator.Up(t.Context())
	}
	if err != nil {
		t.Fatal(err)
	}
	// ...
}
```

Run the same tests against PostgreSQL or MySQL when your queries use features SQLite does not have; the tests of Gonestly itself run against all of them.

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
