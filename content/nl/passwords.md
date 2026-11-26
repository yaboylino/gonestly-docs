---
title: Wachtwoorden
description: Bewaar wachtwoorden met Argon2id, controleer ze in constante tijd, werk oude hashes bij en laat logins niet verraden welke accounts bestaan.
---

Een wachtwoord wordt nooit bewaard. Wat wel bewaard wordt, is een hash die traag en geheugenhongerig is gemaakt, zodat iemand die de database steelt niet miljarden gokken kan proberen. Gonestly gebruikt **Argon2id**, het algoritme dat OWASP en RFC 9106 aanbevelen.

> [!NOTE]
> De module `password` is beschikbaar vanaf versie 0.4.0.

## Instellen

```sh
go get github.com/yaboylino/gonestly/password
```

```go title="internal/app/module.go"
Imports: gonestly.Imports(
	// ...
	password.Module(password.Options{}),
),
```

Elke provider kan nu de `*password.Hasher` injecteren.

## Hashen en controleren

```go title="internal/users/service.go"
func (s *Service) Register(ctx context.Context, email, plain string) error {
	hash, err := s.hasher.Hash(ctx, plain)
	if err != nil {
		return err
	}
	_, err = s.repo.Create(ctx, &User{Email: email, PasswordHash: hash})
	return err
}
```

De hash is één string, zoals `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`. Hij draagt zijn eigen willekeurige salt en zijn instellingen, dus hij past in één kolom en kan later gecontroleerd worden, ook als je instellingen veranderd zijn.

```go
ok, upgrade, err := s.hasher.Verify(ctx, attempt, user.PasswordHash)
```

Een fout wachtwoord is geen fout: `ok` is false. Een fout betekent dat de controle niet gedaan kon worden, bijvoorbeeld bij een bewaarde waarde die geen Argon2id-hash is. De vergelijking kost voor elk fout wachtwoord evenveel tijd.

## Hashes bijwerken

Als je de instellingen verhoogt, blijven oude hashes werken, en `upgrade` zegt wanneer er een zwakker is dan de huidige instellingen. Het wachtwoord is juist en in jouw handen, dus dit is het moment om de hash te vervangen:

```go
if ok && upgrade {
	if hash, err := s.hasher.Hash(ctx, attempt); err == nil {
		_ = s.repo.SetPasswordHash(ctx, user.ID, hash)
	}
}
```

## Logins die geen accounts verraden

Als een login voor een onbekend e-mailadres meteen terugkeert en een voor een bekend adres 50 milliseconden duurt, kan een aanvaller je gebruikers opsommen door te timen. Doe in beide gevallen hetzelfde werk:

```go
user, err := s.repo.ByEmail(ctx, email)
if errors.Is(err, sql.ErrNotFound) {
	_ = s.hasher.Dummy(ctx, attempt)
	return nil, ErrInvalidLogin
}
```

Beantwoord een onbekend e-mailadres en een fout wachtwoord met dezelfde melding.

## Instellingen

De standaard is de aanbeveling met laag geheugen uit RFC 9106: 64 MiB, 3 rondes, 4 lanes, wat op een server tientallen milliseconden kost. Pas ze aan in `password.Options`, bij voorkeur naar het meeste dat je server kan missen terwijl logins snel blijven:

| Optie           | Standaard      | Betekenis                                                                   |
| --------------- | -------------- | --------------------------------------------------------------------------- |
| `Memory`        | 65536 (64 MiB) | Geheugen van één hash, in KiB.                                              |
| `Iterations`    | 3              | Rondes over het geheugen.                                                   |
| `Parallelism`   | 4              | Lanes.                                                                      |
| `MaxConcurrent` | aantal CPU's   | Hoeveel hashes tegelijk draaien; anderen wachten tot hun context eindigt.   |
| `Pepper`        | geen           | Een geheim dat in elk wachtwoord wordt gemengd, buiten de database bewaard. |

`MaxConcurrent` doet ertoe: elke hash neemt zijn geheugen, dus een piek aan logins zou al het geheugen kunnen gebruiken. Wachtende hashes geven het op als de context van hun request eindigt. Wachtwoorden langer dan 1024 bytes worden geweigerd met `password.ErrTooLong`, zodat één request de server geen megabytes laat hashen.

Een **pepper** is een tweede verdedigingslinie: een dief van alleen de database kan zonder hem geen gokken controleren. Bewaar hem in de omgeving, nooit naast de hashes, en weet dat veranderen ervan alle bewaarde hashes laat falen.
