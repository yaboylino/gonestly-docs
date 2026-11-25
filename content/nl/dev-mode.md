---
title: Dev-modus
description: gonestly dev bouwt en herstart de applicatie bij elke wijziging, en stopt hem met een duidelijk overzicht als een wijziging de build, vet of de tests breekt.
---

`gonestly dev` draait je applicatie terwijl je werkt. Bij elke save controleert hij de code, en de applicatie draait alleen als die controle slaagt:

```sh
gonestly dev
gonestly dev --test   # draai ook de tests
```

## Wat er gebeurt bij een save

1. De applicatie wordt gebouwd.
2. `go vet` controleert de hele module.
3. Met `--test` draaien de tests van de packages die je wijzigde.

Slaagt elke stap, dan stopt de draaiende applicatie netjes en start de nieuwe versie:

```text
• internal/products/service.go changed
✓ restarted in 450ms
```

Ctrl+C stopt de applicatie op dezelfde manier: die krijgt één interrupt en de tijd om lopende requests af te maken.

Faalt een stap, dan wordt de applicatie **gestopt** en staat elk probleem met bestand, regel en melding op een rij:

```text
• internal/products/service.go changed
✗ the build failed, so the application was stopped:
  internal/products/service.go:45:16: s.repo.FindByIDD undefined
• fix the problem and save; the application starts again when everything passes
```

De applicatie blijft nooit een oudere versie draaien terwijl de code kapot is, dus wat je requests beantwoordt is altijd de code in je editor. Zodra het probleem is opgelost, start hij weer.

## Welke wijzigingen tellen

Alleen bestanden die het programma veranderen, leiden tot een controle:

- Go-bestanden, `go.mod` en `go.sum`,
- `.env`-bestanden,
- bestanden die een `//go:embed`-patroon in de binary opneemt, zoals [migraties](migrations) of templates.

Bestanden die de applicatie zelf schrijft, zoals logs, uploads of een SQLite-database, zorgen nooit voor een herstart. Verborgen mappen, `vendor`, `node_modules` en tijdelijke bestanden van editors worden overgeslagen. Wijzigingen die tegelijk binnenkomen, zoals een save van meerdere bestanden, worden één keer gecontroleerd.

## Tests

Met `--test` draaien bij elke save de tests van de packages waarvan bestanden veranderden, en bij het starten alle tests. Een falende test stopt de applicatie net als een compileerfout:

```text
✗ the tests failed, so the application was stopped:
  --- FAIL: TestCheck (0.00s)
      controller_test.go:18: status = "ok", want "fine"
```

## Opties en argumenten

| Optie    | Doel                                                                        |
| -------- | --------------------------------------------------------------------------- |
| `--test` | Draai ook de tests van de gewijzigde packages.                              |
| `--main` | Het main-package, als dat niet de root van de module is, zoals `./cmd/api`. |

Argumenten na `--` gaan mee naar de applicatie: `gonestly dev -- --verbose`.

De applicatie krijgt een interruptsignaal als hij herstart, zodat zijn [lifecycle-hooks](lifecycle-events) draaien en lopende requests afgerond worden. Stopt hij niet binnen 15 seconden, dan wordt hij beëindigd. Stopt de applicatie uit zichzelf, bijvoorbeeld omdat zijn poort bezet is, dan meldt de dev-modus de exitcode en wacht hij op de volgende wijziging.
