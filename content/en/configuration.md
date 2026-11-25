---
title: Configuration
description: Load typed configuration from environment variables and .env files, with defaults, required values and clear errors.
---

Applications read their configuration from the environment: a port, a database URL, an API key. The `config` package loads it into a typed struct, checks it when the application starts and reports every problem at once.

## Defining the configuration

Describe your configuration as a struct. Each field is read from an environment variable named after the field in upper snake case, so `DatabaseURL` reads `DATABASE_URL`:

```go title="config.go"
type Config struct {
	Port        int           `default:"3000"`
	DatabaseURL string        `env:"DATABASE_URL,required"`
	Debug       bool
	Timeout     time.Duration `default:"5s"`
	Origins     []string
}
```

## The config module

`config.Module` returns a [global module](modules#global-modules) that loads the struct when the application starts and provides it to every module:

```go title="main.go"
var AppModule = &gonestly.Module{
	Name: "app",
	Imports: gonestly.Imports(
		config.Module[Config](config.Options{}),
		users.Module,
	),
}
```

Any provider can now ask for a `Config`:

```go
func NewServer(cfg Config) *Server {
	return &Server{addr: fmt.Sprintf(":%d", cfg.Port)}
}
```

If the configuration is invalid, the application does not start.

## Tags

| Tag                   | Effect                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `env:"NAME"`          | Reads the variable `NAME` instead of the name derived from the field. |
| `env:"NAME,required"` | Fails when the variable is missing or empty.                          |
| `env:",required"`     | Keeps the derived name and makes the field required.                  |
| `env:"-"`             | Never reads the field.                                                |
| `default:"value"`     | Uses the value when the variable is not set.                          |

A variable that is set but empty is used as it is: it does not fall back to the default. For a number that means an error, which points you straight at the empty line in your `.env` file.

## Supported types

Strings, booleans, all integer and float types, `time.Duration` (such as `30s` or `5m`), slices of these as a comma separated list, and every type that implements `encoding.TextUnmarshaler`, such as `netip.Addr`.

## Nested structs

A nested struct groups related settings. Its fields get the field name as a prefix:

```go
type Config struct {
	Redis RedisConfig // reads REDIS_HOST and REDIS_PORT
	Cache RedisConfig `env:"CACHE_STORE"` // reads CACHE_STORE_HOST and CACHE_STORE_PORT
}

type RedisConfig struct {
	Host string `default:"localhost"`
	Port int    `default:"6379"`
}
```

The fields of an embedded struct are read without a prefix.

## Dotenv files

By default the config package also reads a `.env` file from the working directory:

```dotenv title=".env"
# Local development settings
DATABASE_URL=postgres://localhost/shop
DEBUG=true
ORIGINS="http://localhost:4200, http://localhost:3000"
```

Real environment variables always take precedence over the file, so production settings never come from a forgotten `.env`. Choose other files with `Files`; later files override earlier ones and missing files are skipped:

```go
config.Module[Config](config.Options{
	Files: []string{".env", ".env.local"},
})
```

Pass an empty slice to read no files at all. Values can be unquoted, single quoted (taken literally) or double quoted (with `\n`, `\t` and `\"` escapes). Variables are not expanded.

## Prefix

To avoid clashes with other programs, give every variable a prefix:

```go
config.Module[Config](config.Options{Prefix: "SHOP_"}) // reads SHOP_PORT, SHOP_DATABASE_URL, ...
```

## Errors

Every invalid or missing value is reported at once, so you fix your configuration in one go:

```text
config: PORT: "abc" is not a valid int
config: DATABASE_URL is required
config: TIMEOUT: "5" is not a valid duration, such as 30s or 5m
```

## Loading without a module

`config.Load` returns the struct directly, for example in a small command line tool:

```go
cfg, err := config.Load[Config](config.Options{})
```
