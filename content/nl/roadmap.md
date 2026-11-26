---
title: Roadmap
description: Wat Gonestly nu biedt en wat er nog komt, van HTTP-controllers tot de SQL-laag en de CLI.
---

Gonestly wordt in fases gebouwd. Elke fase is af, getest en gedocumenteerd voordat de volgende begint, en `v0.1.0` is de eerste release.

## Beschikbaar

- **Modules en dependency injection**, met imports, exports, globale modules en controle van de hele graaf bij het opstarten.
- **Lifecycle-events**, netjes afsluiten en de applicatie stoppen vanuit een provider.
- **Configuratie** uit omgevingsvariabelen en `.env`-bestanden.
- **Testen** met overrides en requests zonder poort.
- **Database**: [repositories](repositories), een getypeerde [querybuilder](queries), [transacties](transactions) en [migraties](migrations) voor PostgreSQL, MySQL, MariaDB en SQLite.
- **HTTP**: [controllers](controllers) met getypeerde handlers, binding van requests, [validatie](validation), [guards](guards), [interceptors](interceptors), [middleware](middleware) en problem details voor fouten.
- **Formulieren en bestandsuploads**, [authenticatie](authentication) met JSON Web Tokens, [rate limiting](middleware#rate-limiting), CORS en [health-checks](health-checks).
- **OpenAPI** voor elke route, gegenereerd uit de code en geserveerd met Swagger UI; zie [OpenAPI](openapi).
- **CLI**: [nieuwe projecten, generators](cli), een [dev-modus](dev-mode) die de applicatie stopt als een wijziging hem breekt, en migraties.

## Hierna

Tot `v1.0.0` gaat het werk naar wat echte projecten nodig hebben: feedback op de API, meer voorbeelden en fixes. Open een issue op GitHub om te laten weten wat je mist.

## Op de hoogte blijven

De [changelog](https://github.com/yaboylino/gonestly/blob/main/CHANGELOG.md) noemt elke wijziging, en op [GitHub](https://github.com/yaboylino/gonestly) kun je terecht met vragen en ideeën.
