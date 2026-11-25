---
title: Testen
description: Test modules los door providers te vervangen door nepversies en providers op te halen uit een draaiende applicatie.
---

Omdat elke afhankelijkheid wordt geïnjecteerd, komt het testen van een Gonestly-module neer op het bouwen van die module met een paar providers vervangen. Je gebruikt het standaardpackage `testing`; een speciale testrunner is niet nodig.

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
