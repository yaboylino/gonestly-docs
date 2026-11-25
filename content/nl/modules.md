---
title: Modules
description: Modules groeperen samenhangende providers en bepalen via imports en exports welke andere modules ze mogen gebruiken.
---

Een module groepeert de providers van één onderdeel, zoals users, facturatie of de database, en bepaalt welke daarvan de rest van de applicatie mag gebruiken. Elke applicatie heeft een rootmodule, en de modules die hij importeert vormen een boom.

```go title="users/module.go"
var Module = &gonestly.Module{
	Name:      "users",
	Imports:   gonestly.Imports(database.Module),
	Providers: gonestly.Providers(NewRepository, NewService),
	Exports:   gonestly.Exports(NewService),
}
```

| Veld        | Doel                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `Name`      | Herkent de module in foutmeldingen en logs. De naam moet uniek zijn binnen de applicatie.              |
| `Imports`   | Modules waarvan deze module de geëxporteerde providers kan injecteren.                                 |
| `Providers` | Constructors en waarden die de applicatie voor deze module bouwt. Zie [providers](providers).          |
| `Exports`   | De providers die modules die deze module importeren kunnen injecteren.                                 |
| `Global`    | Maakt de exports beschikbaar voor elke module, zonder import. Zie [globale modules](#globale-modules). |

## Een module declareren

Declareer elke module één keer, als pointer op packageniveau, en importeer die pointer overal waar je hem nodig hebt. Een module wordt herkend aan zijn pointer, dus dezelfde module die door tien andere modules wordt geïmporteerd, wordt toch maar één keer gebouwd.

> [!WARNING]
> Bouw modules niet in een functie die vaker wordt aangeroepen. Twee verschillende `*gonestly.Module`-waarden met dezelfde naam worden als conflict gemeld.

## Afscherming

Providers zijn standaard privé binnen hun module. Een module kan alleen injecteren:

- zijn eigen providers,
- de exports van de modules die hij importeert,
- de exports van [globale modules](#globale-modules).

In het voorbeeld hierboven is `NewRepository` een implementatiedetail van de usersmodule: andere modules kunnen hem niet injecteren, dus je kunt hem vrij aanpassen. Alleen de service hoort bij de publieke kant van de module.

## Exports

Exporteer een provider door zijn constructor aan `Exports` mee te geven. Een provider die met `gonestly.Value` is gemaakt heeft geen constructor; exporteer die via zijn type met `gonestly.Type`:

```go
var Module = &gonestly.Module{
	Name:      "settings",
	Providers: gonestly.Providers(NewStore, gonestly.Value(defaults)),
	Exports:   gonestly.Exports(NewStore, gonestly.Type[Defaults]()),
}
```

Je kunt ook een `Provider`-waarde aan `Exports` meegeven. Dat is handig voor providers die met `As` of `Alias` zijn gemaakt. Zie [eigen providers](custom-providers).

## Modules doorgeven

Een module kan alles wat een geïmporteerde module exporteert doorgeven door de module zelf te exporteren. Zo bundel je een paar onderliggende modules tot één:

```go title="core/module.go"
var Module = &gonestly.Module{
	Name:    "core",
	Imports: gonestly.Imports(database.Module, cache.Module),
	Exports: gonestly.Exports(database.Module, cache.Module),
}
```

Modules die `core.Module` importeren, kunnen nu alles injecteren wat de database- en cachemodule exporteren.

## Globale modules

Sommige providers zijn bijna overal nodig, zoals de configuratie. In plaats van hun module in elke featuremodule te importeren, maak je hem globaal:

```go
var Module = &gonestly.Module{
	Name:      "config",
	Global:    true,
	Providers: gonestly.Providers(LoadConfig),
	Exports:   gonestly.Exports(LoadConfig),
}
```

Een globale module moet nog steeds één keer geïmporteerd worden, meestal door de rootmodule, zodat hij deel uitmaakt van de applicatie. Daarna zijn zijn exports in elke module zichtbaar.

> [!HINT]
> Gebruik globale modules spaarzaam. Expliciete imports laten zien welk onderdeel waarvan afhangt, en ze houden modules makkelijk los te testen.

## Volgorde bij het opzoeken

Vraagt een provider om een type, dan zoekt Gonestly in deze volgorde, en de eerste treffer wint:

- de eigen providers van de module,
- de exports van zijn imports,
- de exports van globale modules.

Exporteren twee geïmporteerde modules verschillende providers van hetzelfde type, dan weigert de applicatie te starten en vraagt hij je het type maar vanuit één module te exporteren. Hetzelfde geldt voor twee globale modules.

## Ingebouwde providers

Gonestly voegt aan elke applicatie een globale module met de naam `gonestly` toe. Die levert:

- `*slog.Logger`, de logger die je met `gonestly.WithLogger` instelt, anders `slog.Default()`,
- `gonestly.Shutdowner`, om de applicatie vanuit een provider te stoppen. Zie [lifecycle-events](lifecycle-events#stoppen-vanuit-een-provider).

De naam `gonestly` is voor deze module gereserveerd.
