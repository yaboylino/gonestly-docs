---
title: Caching
description: Bewaar de resultaten van traag werk een tijdje, deel één load tussen gelijktijdige requests, cache hele responses en laat clients opnieuw valideren.
---

Sommig werk is traag en het antwoord verandert zelden: een rapport, een aanroep naar een andere service, een lijst die elke bezoeker opvraagt. Een cache bewaart het resultaat een tijdje, zodat het werk één keer gedaan wordt en het antwoord klaarstaat voor iedereen daarna.

> [!NOTE]
> De modules `cache` en `redis` zijn beschikbaar vanaf versie 0.4.0.

## Instellen

```go title="internal/app/module.go"
Imports: gonestly.Imports(
	// ...
	cache.Module(cache.Options{DefaultTTL: time.Minute}),
),
```

Elke provider kan nu de `*cache.Cache` injecteren. Standaard bewaart hij waarden in het geheugen van het proces, tot 64 MiB, en gooit hij de minst recent gebruikte weg als hij vol zit. Dat is goed voor één instantie. Met meerdere instanties heeft elk zijn eigen cache, en een waarde die in de ene verandert is verouderd in de andere, dus gebruik dan een gedeelde store.

## Remember

`cache.Remember` is de aanroep die je het meest gebruikt. Hij geeft de waarde onder een sleutel terug, of laadt hem, bewaart hem en geeft hem terug:

```go
func (s *Service) Find(ctx context.Context, id int64) (User, error) {
	return cache.Remember(ctx, s.cache, fmt.Sprintf("user:%d", id), time.Minute,
		func(ctx context.Context) (User, error) {
			return s.repo.Find(ctx, id)
		})
}
```

- **Eén load voor veel aanroepers.** Als vijftig requests op hetzelfde moment om een ontbrekende sleutel vragen, draait de loader één keer en delen ze het resultaat. Anders zou elk request de populaire waarde berekenen terwijl hij weg is, precies als de database er het minst tegen kan.
- **Fouten worden niet gecachet.** Een loader die faalt geeft zijn fout aan de wachtende aanroepers, en het volgende request probeert het opnieuw.
- **Een aanroeper die opgeeft laat de anderen niet falen.** De loader houdt de waarden van het request, zoals het [request-ID](logging), maar eindigt er niet mee.
- **Een panic in de loader** wordt een fout.

Waarden worden als JSON bewaard, dus gebruik types die te coderen en te decoderen zijn. Een bewaarde waarde die niet meer bij het type past, nadat je het type in een deploy wijzigde, wordt weggegooid en opnieuw geladen in plaats van te falen.

`cache.Get` en `cache.Set` zijn dezelfde onderdelen zonder het laden, voor als je controle wilt. `ttl` 0 betekent `DefaultTTL`, 5 minuten tenzij je iets anders instelt.

## Een falende cache is een lege cache

Een cache is een optimalisatie, dus een request mag niet falen omdat de cache eruit ligt. Als de store een fout geeft, wordt de aanroep als waarschuwing gelogd, geteld in `cache.Stats().Errors` en behandeld als een gemiste: `Remember` laadt de waarde alsof er geen cache was.

```go
stats := c.Stats() // Hits, Misses, Loads en Errors
```

## Invalidatie

Verwijder een sleutel als de data erachter verandert, of alles onder een prefix:

```go
c.Delete(ctx, "user:7")
c.DeletePrefix(ctx, "user:")
c.Clear(ctx) // elke sleutel van deze cache
```

Geef elke applicatie een eigen `Prefix` in de opties, zodat meerdere applicaties één store kunnen gebruiken zonder elkaars sleutels tegen te komen, en `Clear` alleen de jouwe leegt.

## De cache delen tussen instanties

De module `redis` bewaart vermeldingen in Redis, zodat alle instanties dezelfde cache zien:

```sh
go get github.com/yaboylino/gonestly/redis
```

```go
cache.ModuleFunc(func(cfg Config) cache.Options {
	store, err := redis.Open(context.Background(), cfg.RedisURL) // redis://:password@host:6379/0
	// handel err af
	return cache.Options{Store: store, Prefix: "shop:", DefaultTTL: time.Minute}
})
```

`rediss://` gebruikt TLS. De store pingt Redis als de applicatie gevraagd wordt of ze gezond is, dus een [health-check](health-checks) vertelt wanneer Redis weg is, en sluit zijn verbinding als de applicatie stopt. Verwijderen op prefix scant de sleutels in batches zonder Redis te blokkeren; gebruik het voor invalidatie af en toe, niet bij elk request.

Een eigen store schrijven, voor Memcached of een database, kost drie methoden: `Get`, `Set` en `Delete`, en `DeletePrefix` als het kan. Het pakket `cachetest` controleert of een store het contract nakomt.

## Responses cachen

`cache.Responses` cachet de response van een GET-route:

```go
gonestly.Get(r, "/products", c.List,
	gonestly.WithInterceptors(cache.Responses(s.cache, time.Minute)))
```

Het is een [interceptor](interceptors), dus hij draait na de guards, het binden en de validatie: een gecachete response wordt alleen geleverd aan een aanroeper die binnen mocht en een geldig request stuurde. De route-handler draait één keer voor gelijktijdige misses, en elke response zegt `X-Cache: HIT` of `MISS`.

Waaruit de sleutel bestaat bepaalt wie een response deelt:

| Deel van de sleutel                 | Standaard                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| Pad en query                        | altijd; de volgorde van parameters doet er niet toe        |
| Headers `Authorization` en `Cookie` | elke inloggegevens hebben hun eigen response               |
| Andere requestheaders               | `cache.Vary("Accept-Language")` voegt ze toe               |
| Je eigen regel                      | `cache.KeyFunc(...)`; een lege sleutel slaat de cache over |

De standaard is veilig voor data die afhangt van wie vraagt. Is de data hetzelfde voor iedereen die hem mag zien, voeg dan `cache.SharedAcrossUsers()` toe, en alle aanroepers delen één vermelding.

Fouten, responses zonder body en andere methoden worden niet gecachet. Om na een wijziging te invalideren verwijder je op prefix:

```go
c.DeletePrefix(ctx, cache.ResponsePrefix("/products"))
```

## ETags en hervalidatie

`cache.ETag()` is middleware die GET- en HEAD-responses een `ETag` geeft, een vingerafdruk van de body, en **304 Not Modified** zonder body antwoordt als een client hem terugstuurt in `If-None-Match`:

```go
gonestly.ServerConfig{Middleware: []gonestly.Middleware{cache.ETag()}}
```

Browsers, mobiele apps en CDN's valideren dan opnieuw voor de prijs van een header in plaats van de response opnieuw te downloaden. Hij staat los van de cache-store en laat een ETag die jouw handler zette met rust. Responses boven 1 MiB en streams komen onaangeroerd door.

## Opties

| Optie        | Standaard             | Betekenis                                               |
| ------------ | --------------------- | ------------------------------------------------------- |
| `Store`      | geheugen, 64 MiB      | Waar de waarden staan.                                  |
| `Prefix`     | geen                  | Voor elke sleutel gezet.                                |
| `DefaultTTL` | 5 minuten             | Hoe lang een waarde leeft als de aanroep het niet zegt. |
| `Logger`     | die van de applicatie | Ontvangt de fouten van de store.                        |
