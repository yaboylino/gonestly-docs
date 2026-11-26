---
title: Passwords
description: Store passwords with Argon2id, check them in constant time, upgrade old hashes and keep logins from revealing which accounts exist.
---

A password is never stored. What is stored is a hash made to be slow and memory hungry, so that someone who steals the database cannot try billions of guesses. Gonestly uses **Argon2id**, the algorithm that OWASP and RFC 9106 recommend.

> [!NOTE]
> The `password` module is available from version 0.4.0.

## Setup

```sh
go get github.com/yaboylino/gonestly/password
```

```go title="internal/app/module.go"
Imports: gonestly.Imports(
	// ...
	password.Module(password.Options{}),
),
```

Any provider can now inject the `*password.Hasher`.

## Hashing and checking

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

The hash is one string, such as `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`. It carries its own random salt and its settings, so it fits in one column and can be checked later even when your settings changed.

```go
ok, upgrade, err := s.hasher.Verify(ctx, attempt, user.PasswordHash)
```

A wrong password is not an error: `ok` is false. An error means the check could not be done, for example a stored value that is not an Argon2id hash. The comparison takes the same time for every wrong password.

## Upgrading hashes

When you raise the settings, old hashes keep working, and `upgrade` tells you when one is weaker than the current settings. The password is right and in your hands, so this is the moment to replace the hash:

```go
if ok && upgrade {
	if hash, err := s.hasher.Hash(ctx, attempt); err == nil {
		_ = s.repo.SetPasswordHash(ctx, user.ID, hash)
	}
}
```

## Logins that do not reveal accounts

If a login for an unknown email returns at once and one for a known email takes 50 milliseconds, an attacker can list your users by timing. Do the same work in both cases:

```go
user, err := s.repo.ByEmail(ctx, email)
if errors.Is(err, sql.ErrNotFound) {
	_ = s.hasher.Dummy(ctx, attempt)
	return nil, ErrInvalidLogin
}
```

Answer an unknown email and a wrong password with the same message.

## Settings

The defaults are the low memory recommendation of RFC 9106: 64 MiB, 3 passes, 4 lanes, which takes tens of milliseconds on a server. Change them in `password.Options`, ideally to the most your server can afford while logins stay quick:

| Option          | Default        | Meaning                                                            |
| --------------- | -------------- | ------------------------------------------------------------------ |
| `Memory`        | 65536 (64 MiB) | Memory of one hash, in KiB.                                        |
| `Iterations`    | 3              | Passes over the memory.                                            |
| `Parallelism`   | 4              | Lanes.                                                             |
| `MaxConcurrent` | CPU count      | How many hashes run at once; others wait until their context ends. |
| `Pepper`        | none           | A secret mixed into every password, kept outside the database.     |

`MaxConcurrent` matters: every hash takes its memory, so a burst of logins could use all of it. Waiting hashes give up when the context of their request ends. Passwords longer than 1024 bytes are refused with `password.ErrTooLong`, so one request cannot make the server hash megabytes.

A **pepper** is a second line of defence: a thief of the database alone cannot check guesses without it. Keep it in the environment, never next to the hashes, and know that changing it makes every stored hash fail.
