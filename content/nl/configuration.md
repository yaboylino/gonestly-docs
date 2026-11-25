---
title: Configuratie
description: Laad getypeerde configuratie uit omgevingsvariabelen en .env-bestanden, met defaults, verplichte waarden en duidelijke fouten.
---

Applicaties halen hun configuratie uit de omgeving: een poort, een database-URL, een API-sleutel. Het package `config` laadt die in een getypeerde struct, controleert hem als de applicatie start en meldt alle problemen tegelijk.

## De configuratie beschrijven

Beschrijf je configuratie als struct. Elk veld wordt gelezen uit een omgevingsvariabele met de naam van het veld in hoofdletters met underscores, dus `DatabaseURL` leest `DATABASE_URL`:

```go title="config.go"
type Config struct {
	Port        int           `default:"3000"`
	DatabaseURL string        `env:"DATABASE_URL,required"`
	Debug       bool
	Timeout     time.Duration `default:"5s"`
	Origins     []string
}
```

## De configmodule

`config.Module` geeft een [globale module](modules#globale-modules) terug die de struct laadt als de applicatie start en hem aan elke module levert:

```go title="main.go"
var AppModule = &gonestly.Module{
	Name: "app",
	Imports: gonestly.Imports(
		config.Module[Config](config.Options{}),
		users.Module,
	),
}
```

Elke provider kan nu om een `Config` vragen:

```go
func NewServer(cfg Config) *Server {
	return &Server{addr: fmt.Sprintf(":%d", cfg.Port)}
}
```

Is de configuratie ongeldig, dan start de applicatie niet.

## Tags

| Tag                   | Effect                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| `env:"NAAM"`          | Leest de variabele `NAAM` in plaats van de naam die uit het veld volgt. |
| `env:"NAAM,required"` | Faalt als de variabele ontbreekt of leeg is.                            |
| `env:",required"`     | Houdt de afgeleide naam en maakt het veld verplicht.                    |
| `env:"-"`             | Leest het veld nooit.                                                   |
| `default:"waarde"`    | Gebruikt de waarde als de variabele niet is gezet.                      |

Een variabele die wel gezet maar leeg is, wordt gebruikt zoals hij is: hij valt niet terug op de default. Voor een getal geeft dat een fout, die je direct naar de lege regel in je `.env`-bestand wijst.

## Ondersteunde types

Strings, booleans, alle integer- en floattypes, `time.Duration` (zoals `30s` of `5m`), slices daarvan als lijst gescheiden door komma's, en elk type dat `encoding.TextUnmarshaler` implementeert, zoals `netip.Addr`.

## Geneste structs

Een geneste struct groepeert samenhangende instellingen. Zijn velden krijgen de veldnaam als prefix:

```go
type Config struct {
	Redis RedisConfig // leest REDIS_HOST en REDIS_PORT
	Cache RedisConfig `env:"CACHE_STORE"` // leest CACHE_STORE_HOST en CACHE_STORE_PORT
}

type RedisConfig struct {
	Host string `default:"localhost"`
	Port int    `default:"6379"`
}
```

De velden van een ingebedde struct worden zonder prefix gelezen.

## Dotenv-bestanden

Standaard leest het configpackage ook een `.env`-bestand uit de werkmap:

```dotenv title=".env"
# Instellingen voor lokale ontwikkeling
DATABASE_URL=postgres://localhost/shop
DEBUG=true
ORIGINS="http://localhost:4200, http://localhost:3000"
```

Echte omgevingsvariabelen gaan altijd voor het bestand, dus productie-instellingen komen nooit uit een vergeten `.env`. Kies andere bestanden met `Files`; latere bestanden overschrijven eerdere en ontbrekende bestanden worden overgeslagen:

```go
config.Module[Config](config.Options{
	Files: []string{".env", ".env.local"},
})
```

Geef een lege slice mee om helemaal geen bestanden te lezen. Waarden mogen zonder aanhalingstekens, met enkele aanhalingstekens (letterlijk overgenomen) of met dubbele aanhalingstekens (met `\n`, `\t` en `\"`). Variabelen worden niet uitgevuld.

## Prefix

Geef elke variabele een prefix om botsingen met andere programma's te voorkomen:

```go
config.Module[Config](config.Options{Prefix: "SHOP_"}) // leest SHOP_PORT, SHOP_DATABASE_URL, ...
```

## Fouten

Alle ongeldige of ontbrekende waarden worden tegelijk gemeld, zodat je je configuratie in één keer goed zet:

```text
config: PORT: "abc" is not a valid int
config: DATABASE_URL is required
config: TIMEOUT: "5" is not a valid duration, such as 30s or 5m
```

## Laden zonder module

`config.Load` geeft de struct direct terug, bijvoorbeeld in een kleine command line tool:

```go
cfg, err := config.Load[Config](config.Options{})
```
