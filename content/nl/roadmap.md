---
title: Roadmap
description: Wat Gonestly nu biedt en wat er nog komt, van HTTP-controllers tot de SQL-laag en de CLI.
---

Gonestly wordt in fases gebouwd. Elke fase is af, getest en gedocumenteerd voordat de volgende begint, en de eerste openbare release volgt zodra de CLI er is.

## Beschikbaar

- **Modules en dependency injection**, met imports, exports, globale modules en controle van de hele graaf bij het opstarten.
- **Lifecycle-events**, netjes afsluiten en de applicatie stoppen vanuit een provider.
- **Configuratie** uit omgevingsvariabelen en `.env`-bestanden.
- **Testen** met overrides en requests zonder poort.
- **Database**: [repositories](repositories), een getypeerde [querybuilder](queries), [transacties](transactions) en [migraties](migrations) voor PostgreSQL en SQLite.
- **HTTP**: [controllers](controllers) met getypeerde handlers, binding van requests, [validatie](validation), [guards](guards), [interceptors](interceptors), [middleware](middleware) en problem details voor fouten.
- **OpenAPI** voor elke route, gegenereerd uit de code en geserveerd met Swagger UI; zie [OpenAPI](openapi).

## MySQL

Ondersteuning voor MySQL in de SQL-laag, na PostgreSQL en SQLite.

## CLI

- `gonestly new` maakt een project dat direct draait.
- `gonestly generate` maakt modules, controllers, services en complete CRUD-resources, en registreert ze in de juiste module.
- `gonestly dev` houdt het project in de gaten en controleert het bij elke save: hij bouwt de code, draait `go vet` en met `--test` ook de tests van de packages die je wijzigde. Slaagt alles, dan herstart de applicatie. Faalt er iets, dan stopt de applicatie en staat elk probleem met bestand en regel op een rij, zodat een kapotte wijziging nooit lijkt te werken.
- `gonestly migrate`, `gonestly routes` en `gonestly openapi`.

## Op de hoogte blijven

De [changelog](https://github.com/yaboylino/gonestly/blob/main/CHANGELOG.md) noemt elke wijziging, en op [GitHub](https://github.com/yaboylino/gonestly) kun je terecht met vragen en ideeën.
