---
title: Roadmap
description: Wat Gonestly nu biedt en wat er nog komt, van HTTP-controllers tot de SQL-laag en de CLI.
---

Gonestly wordt in fases gebouwd. Elke fase is af, getest en gedocumenteerd voordat de volgende begint, en de eerste openbare release volgt zodra de SQL-laag en de CLI er zijn.

## Beschikbaar

- **Modules en dependency injection**, met imports, exports, globale modules en controle van de hele graaf bij het opstarten.
- **Lifecycle-events**, netjes afsluiten en de applicatie stoppen vanuit een provider.
- **Configuratie** uit omgevingsvariabelen en `.env`-bestanden.
- **Testen** met overrides en requests zonder poort.
- **HTTP**: [controllers](controllers) met getypeerde handlers, binding van requests, [validatie](validation), [guards](guards), [interceptors](interceptors), [middleware](middleware) en problem details voor fouten.

## OpenAPI

Een OpenAPI-document dat uit de routes en hun request- en responsetypes wordt gegenereerd, zodat de API zonder annotaties beschreven is, en dat ernaast wordt geserveerd.

## SQL

Een typeveilige SQL-laag in drie niveaus: generieke repositories voor alledaagse CRUD, een getypeerde querybuilder met kolommen die de CLI genereert, en ruwe SQL die direct in structs wordt ingelezen.

```go
users, err := sql.From[User](db).
	Where(user.Email.Like("%@example.com"), user.Active.Eq(true)).
	OrderBy(user.CreatedAt.Desc()).
	Limit(20).
	All(ctx)
```

Transacties reizen mee via de context, relaties laad je expliciet, en migraties zijn gewone SQL-bestanden. PostgreSQL en SQLite komen eerst, MySQL volgt.

## CLI

- `gonestly new` maakt een project dat direct draait.
- `gonestly generate` maakt modules, controllers, services en complete CRUD-resources, en registreert ze in de juiste module.
- `gonestly dev` houdt het project in de gaten en controleert het bij elke save: hij bouwt de code, draait `go vet` en met `--test` ook de tests van de packages die je wijzigde. Slaagt alles, dan herstart de applicatie. Faalt er iets, dan stopt de applicatie en staat elk probleem met bestand en regel op een rij, zodat een kapotte wijziging nooit lijkt te werken.
- `gonestly migrate`, `gonestly routes` en `gonestly openapi`.

## Op de hoogte blijven

De [changelog](https://github.com/yaboylino/gonestly/blob/main/CHANGELOG.md) noemt elke wijziging, en op [GitHub](https://github.com/yaboylino/gonestly) kun je terecht met vragen en ideeën.
