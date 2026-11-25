---
title: Foutmeldingen
description: Elke fout die Gonestly meldt bij het bouwen of starten van een applicatie, wat hij betekent en hoe je hem oplost.
---

Gonestly controleert de hele modulegraaf in `gonestly.New`, voordat er iets wordt gebouwd, en meldt alle problemen tegelijk in een `*gonestly.BuildError`. De meldingen zelf zijn in het Engels, zodat je ze makkelijk kunt opzoeken:

```text
gonestly: the application cannot be built:
  - missing dependency: users.NewService in module "users" needs *database.DB, which is not available there; module "database" exports it: add that module to the Imports of "users"
  - dependency cycle: orders.NewService -> billing.NewService -> orders.NewService
```

## Fouten onderzoeken

Elk probleem verpakt een vaste fout, zodat je met `errors.Is` op een soort probleem kunt controleren:

| Fout                            | Betekenis                                                                 |
| ------------------------------- | ------------------------------------------------------------------------- |
| `gonestly.ErrMissingDependency` | Een provider heeft een type nodig dat in zijn module niet beschikbaar is. |
| `gonestly.ErrDependencyCycle`   | Providers of modules hangen in een cirkel van elkaar af.                  |
| `gonestly.ErrInvalidModule`     | Een module, provider of export is verkeerd gedeclareerd.                  |
| `gonestly.ErrInvalidRoute`      | Een route is verkeerd gedeclareerd of botst met een andere.               |
| `gonestly.ErrNotStarted`        | `Resolve` is aangeroepen op een applicatie die niet draait.               |

De losse problemen staan in `BuildError.Problems`.

## Ontbrekende afhankelijkheden

De melding noemt de provider, zijn module en het type dat hij nodig heeft, gevolgd door een hint:

| Hint                                                           | Wat je doet                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `module "x" exports it: add that module to the Imports of "y"` | Importeer module `x` in module `y`.                                                 |
| `module "x" provides it but does not export it`                | Zet de provider in de `Exports` van `x`, en importeer `x` als je dat nog niet deed. |
| `T is available: did you mean that type?`                      | Je vroeg om `*T` terwijl `T` wordt geleverd, of andersom.                           |
| `*Impl implements it: provide it with gonestly.As[...]`        | Registreer de implementatie met [As](custom-providers#interfaces-met-as).           |
| `no module provides it`                                        | Voeg een provider voor het type toe.                                                |

## Cirkels

Een cirkel noemt de betrokken providers en eindigt waar hij begon:

```text
dependency cycle: orders.NewService -> billing.NewService -> orders.NewService
```

Doorbreek hem door de gedeelde logica naar een derde provider te verplaatsen waar beide van afhangen, of door af te hangen van een kleinere interface. Modules die elkaar importeren, worden gemeld als `modules import each other: "a" -> "b" -> "a"`.

## Verkeerde declaraties

| Melding                                        | Oorzaak                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `int is not a constructor function`            | Er is iets anders dan een functie aan `Providers` meegegeven. |
| `must return a value, or a value and an error` | De constructor geeft niets terug, of alleen een fout.         |
| `must not be variadic`                         | Constructors kunnen geen `...`-parameters hebben.             |
| `provides T twice`                             | Een module registreert twee providers van hetzelfde type.     |
| `exports X, which is not one of its providers` | Een export hoort bij geen enkele provider van de module.      |
| `exports module "x", which it does not import` | Alleen geïmporteerde modules kun je doorgeven.                |
| `two different modules are named "x"`          | Modulenamen moeten uniek zijn, en `gonestly` is gereserveerd. |
| `override X replaces no provider of T`         | Een override in een test vervangt geen enkele provider.       |

## Ongeldige routes

Routes worden geregistreerd als de applicatie start, en `Start` meldt elk probleem voordat de server luistert. Elke melding noemt de route en zijn controller:

```text
invalid route: GET /users/{userId} in users.NewController in module "users": FindOneRequest.ID reads the path value "id", but the path /users/{userId} has no {id} wildcard
```

| Melding                                                          | Oorzaak                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `reads the path value "x", but the path ... has no {x} wildcard` | Een `path`-tag past niet bij de route.                                     |
| `has type T, which cannot be read from the query`                | Het veldtype kan niet uit tekst worden gelezen.                            |
| `has more than one of the tags query, header`                    | Een veld kan maar van één plek komen.                                      |
| `the request type *T must be a struct, a slice or a map`         | Gebruik de struct zelf, geen pointer ernaar.                               |
| `the status 404 is not a success status`                         | `gonestly.Status` is voor geslaagde responses; geef anders een fout terug. |
| `conflicts with pattern`                                         | Twee routes passen bij dezelfde requests.                                  |
| `has no Routes(*gonestly.Router) method`                         | Een type in `Controllers` is geen controller.                              |

## Fouten bij het starten

Fouten uit constructors en starthooks komen terug uit `Start` en `Run`, met de provider en de module:

```text
gonestly: constructing database.Open in module "database": connection refused
gonestly: starting worker.NewWorker in module "worker": queue unavailable
```

Een panic wordt gemeld als `panic: <waarde>`, en een constructor die nil teruggeeft als `returned a nil *T`. Configuratiefouten beginnen met `config:`; zie [configuratie](configuration#fouten).
