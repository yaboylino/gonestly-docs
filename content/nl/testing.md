---
title: Testen
description: Test modules los door providers te vervangen door nepversies en providers op te halen uit een draaiende applicatie.
---

Omdat elke afhankelijkheid wordt geïnjecteerd, komt het testen van een Gonestly-module neer op het bouwen van die module met een paar providers vervangen. Je gebruikt het standaardpackage `testing`; een speciale testrunner is niet nodig, en voor HTTP-tests hoeft er geen server te draaien.

## Controllers testen

Het package `gonestlytest` start een module zonder een poort te openen, stopt hem als de test klaar is en stuurt requests direct naar zijn handler:

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

| Hulpfunctie                                   | Doel                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app.Get`, `Post`, `Put`, `Patch`, `Delete`   | Stuur een request; bodies worden als JSON verstuurd. Extra argumenten zijn paren van headernaam en waarde. |
| `url.Values` of `gonestlytest.Form` als body  | Stuur een [formulier](file-uploads#testen), met bestanden in een `Form`.                                   |
| `app.Request(method, path, body, headers...)` | Stuur elk request; een body als string, `[]byte` of `io.Reader` gaat ongewijzigd mee.                      |
| `res.ExpectStatus(code)`                      | Laat de test falen, met de body erbij, als de status afwijkt.                                              |
| `res.JSON(&v)`                                | Lees de body in.                                                                                           |
| `res.Problem()`                               | Lees een foutresponse in als `gonestly.Problem`.                                                           |
| `gonestlytest.Resolve[T](app)`                | Haal een provider op en laat de test falen als hij ontbreekt.                                              |

`Start` gebruikt een stille logger; opties zoals `gonestly.Override` komen daar bovenop.

## Een moduletest

Bouw de module die je wilt testen, vervang wat met de buitenwereld praat, start hem en haal de provider op die je test:

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

## Testen met een database

Repositories en queries draaien tegen een echte database, dus test ze daar ook tegen. SQLite in een tijdelijk bestand heeft geen server nodig en voert je migraties in milliseconden uit:

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

Draai dezelfde tests tegen PostgreSQL of MySQL als je queries functies gebruiken die SQLite niet heeft; de tests van Gonestly zelf draaien tegen allemaal.

## Overrides

`gonestly.Override` vervangt de provider van hetzelfde type, in welke module die ook staat. Hij accepteert constructors en providers, net als `Providers`:

```go
gonestly.Override(
	gonestly.Value[Store](fakeStore),
	NewFakeMailer, // vervangt de provider van *Mailer
)
```

Een override die geen enkele provider vervangt, wordt als fout gemeld. Een hernoemd type schakelt een nepversie dus nooit stilletjes uit.

## Resolve

`gonestly.Resolve[T]` geeft de provider van type `T` uit de rootmodule van een gestarte applicatie: zijn eigen providers en de exports van zijn imports. Vóór `Start` geeft hij `gonestly.ErrNotStarted` terug.

## Een stille logger

De applicatie logt als hij start en stopt. Geef een logger mee die alles weggooit, dan blijft de testuitvoer schoon:

```go
gonestly.WithLogger(slog.New(slog.DiscardHandler))
```

## De bedrading testen

Het bouwen van een applicatie controleert al de hele modulegraaf. Een test die alleen `gonestly.New` op je rootmodule aanroept, vangt ontbrekende imports en exports in CI af, zonder iets te starten:

```go title="main_test.go"
func TestModuleGraph(t *testing.T) {
	if _, err := gonestly.New(AppModule); err != nil {
		t.Fatal(err)
	}
}
```
