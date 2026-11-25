---
title: Introductie
description: Gonestly is een modulair applicatieframework voor Go, geïnspireerd op NestJS, met dependency injection, getypeerde configuratie en een CLI.
---

Gonestly is een framework voor serverapplicaties in Go die makkelijk aan te passen blijven terwijl ze groeien. Het neemt de architectuur van [NestJS](https://nestjs.com) over: een applicatie is een boom van **modules**, elke module declareert welke **providers** hij maakt, en het framework verbindt ze via **dependency injection**.

Dat gebeurt in gewoon, idiomatisch Go. Er zijn geen decorators om na te bootsen, er wordt geen code gegenereerd in je businesslogica en er is geen reflectie bij elk request. Een provider is een gewone constructorfunctie, en een module een gewone struct.

> [!NOTE]
> Gonestly is volop in ontwikkeling en heeft nog geen eerste release. De onderdelen op deze pagina's werken en zijn getest; de [roadmap](roadmap) laat zien wat er nog komt.

## Filosofie

Met Go start je makkelijk een service, maar een grote service netjes houden is verrassend lastig. Elk team bedenkt zijn eigen manier om afhankelijkheden te verbinden, onderdelen te starten en te stoppen en configuratie te laden. Gonestly geeft die keuzes één vaste vorm, zodat elke Gonestly-applicatie op dezelfde manier is opgebouwd en een nieuwe developer snel zijn weg vindt.

Drie principes sturen het ontwerp:

- **Fouten bij het opstarten, niet tijdens het draaien.** De hele afhankelijkheidsgraaf wordt gecontroleerd als de applicatie wordt gebouwd. Een ontbrekende provider, een vergeten export of een cirkel wordt gemeld voordat er iets draait, met een melding die zegt hoe je het oplost.
- **Eerst gewoon Go.** Constructors, interfaces, `context.Context` en `log/slog`. Wie Go kent, kan een Gonestly-applicatie lezen.
- **De standaardbibliotheek eronder.** Gonestly bouwt op `net/http`, `database/sql` en `log/slog`, dus bestaande packages en middleware blijven werken.

## Wat er nu beschikbaar is

| Onderdeel                                                         | Status             |
| ----------------------------------------------------------------- | ------------------ |
| [Modules](modules) en [providers](providers)                      | Beschikbaar        |
| [Lifecycle-events](lifecycle-events) en netjes afsluiten          | Beschikbaar        |
| [Configuratie](configuration) uit de omgeving en `.env`-bestanden | Beschikbaar        |
| [Testen](testing) met overrides                                   | Beschikbaar        |
| HTTP-controllers, guards en interceptors                          | [Gepland](roadmap) |
| Typeveilige SQL-laag en migraties                                 | [Gepland](roadmap) |
| CLI met generators en een watch-modus                             | [Gepland](roadmap) |

## Volgende stappen

Begin met de [eerste stappen](first-steps) om een kleine applicatie te bouwen, en lees daarna over [modules](modules) en [providers](providers), de twee begrippen waarop al het andere is gebouwd.
