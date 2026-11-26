---
title: Queries
description: Bouw getypeerde queries uit kolommen, of schrijf ruwe SQL die direct in structs wordt ingelezen.
---

Naast [repositories](repositories) biedt de SQL-laag twee manieren om te queryen: een getypeerde querybuilder voor de gewone gevallen, en ruwe SQL voor al het andere. Beide lezen de rijen in je [modellen](database#modellen) in.

## De querybuilder

`sql.From` start een query op de tabel van een model. Condities bouw je uit getypeerde kolommen:

```go title="users/columns.go"
var (
	userName      = sql.Col[string]("name")
	userEmail     = sql.Col[*string]("email")
	userTeamID    = sql.Col[int64]("team_id")
	userCreatedAt = sql.Col[time.Time]("created_at")
)
```

```go
users, err := sql.From[User](db).
	Where(userTeamID.Eq(teamID), userEmail.Like("%@example.com")).
	OrderBy(userCreatedAt.Desc()).
	Limit(20).
	Offset(40).
	All(ctx)
```

Een kolom kent zijn type, dus `userTeamID.Eq("1")` compileert niet. Elke methode geeft een nieuwe query terug, zodat je een basisquery één keer opbouwt en veilig uitbreidt.

> [!HINT]
> `gonestly generate columns` schrijft deze kolommen voor elk model in een package; zie [generators](generators#getypeerde-kolommen).

### Condities

| Methode                             | SQL                                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| `Eq(v)`, `Ne(v)`                    | `=`, `<>`; een nil-pointer wordt `IS NULL` of `IS NOT NULL` |
| `Gt`, `Gte`, `Lt`, `Lte`            | `>`, `>=`, `<`, `<=`                                        |
| `Like(pattern)`                     | `LIKE`                                                      |
| `Between(low, high)`                | `BETWEEN`                                                   |
| `In(values...)`, `NotIn(values...)` | `IN`, `NOT IN`; een lege lijst matcht niets                 |
| `IsNull()`, `IsNotNull()`           | `IS NULL`, `IS NOT NULL`                                    |

Condities die je aan `Where` meegeeft, moeten allemaal kloppen. Combineer ze met `sql.And`, `sql.Or` en `sql.Not`, en schrijf wat kolommen niet kunnen uitdrukken met `sql.Raw`:

```go
sql.From[User](db).Where(
	sql.Or(userTeamID.Eq(1), userTeamID.Eq(2)),
	sql.Raw("lower(name) = lower(?)", name),
)
```

### Resultaten

| Methode                         | Geeft terug                                                |
| ------------------------------- | ---------------------------------------------------------- |
| `All(ctx)`                      | Alle rijen die matchen.                                    |
| `First(ctx)`                    | De eerste rij die matcht, of `sql.ErrNotFound`.            |
| `Count(ctx)`                    | Het aantal rijen dat matcht.                               |
| `Exists(ctx)`                   | Of er een rij matcht.                                      |
| `Update(ctx, column.Set(v)...)` | Wijzigt de rijen die matchen en geeft het aantal terug.    |
| `Delete(ctx)`                   | Verwijdert de rijen die matchen en geeft het aantal terug. |
| `SQL()`                         | Het statement en zijn argumenten, voor logging en tests.   |

`Update` en `Delete` zonder conditie geven `sql.ErrUnsafeQuery` terug in plaats van de hele tabel te wijzigen. Geef `sql.Always()` mee als je dat wel wilt:

```go
removed, err := sql.From[Session](db).Where(sql.Always()).Delete(ctx)
```

## Ruwe SQL

`sql.Query` voert je eigen SQL uit en leest elke rij in een model in, waarbij kolommen op naam aan velden worden gekoppeld:

```go
users, err := sql.Query[User](ctx, db, `
	SELECT u.* FROM users u
	JOIN memberships m ON m.user_id = u.id
	WHERE m.team_id = ? AND u.created_at > ?`, teamID, since)
```

Voor één waarde lees je in een basistype in:

```go
total, err := sql.QueryOne[int64](ctx, db, "SELECT COUNT(*) FROM orders WHERE status = ?", "paid")
```

`QueryOne` geeft `sql.ErrNotFound` terug als er geen rij is en `sql.ErrTooManyRows` als er meer dan één is. Een kolom zonder bijbehorend veld is een fout die de kolom noemt, zodat een typefout nooit onopgemerkt blijft. Om het resultaat van een join of een aggregatie te lezen, definieer je er een struct voor:

```go
type TeamStats struct {
	TeamID int64 `db:"team_id"`
	Users  int64 `db:"users"`
}

stats, err := sql.Query[TeamStats](ctx, db, "SELECT team_id, COUNT(*) AS users FROM users GROUP BY team_id")
```

### Placeholders

Schrijf `?` voor elk argument, in elke database; Gonestly zet hem om voor het dialect, zoals `$1` voor PostgreSQL. Vraagtekens in tekst tussen aanhalingstekens en in commentaar blijven staan, en `??` staat voor een letterlijk vraagteken, zoals de `?`-operator van `jsonb` in PostgreSQL.

Een slice als argument wordt uitgevouwen tot een lijst, wat `IN`-queries makkelijk maakt:

```go
users, err := sql.Query[User](ctx, db, "SELECT * FROM users WHERE id IN (?)", []int64{1, 2, 3})
```

Een lege slice is een fout, omdat `IN ()` geen geldige SQL is.

## Gerelateerde rijen

Declareer [relaties](relations) om gerelateerde rijen te laden met `Include`. De SQL-laag laadt ze nooit stiekem, dus er zijn geen verborgen queries. Zonder relatie laad je ze met één extra query en groepeer je ze met `sql.GroupBy`:

```go
posts, err := sql.From[Post](db).Where(postUserID.In(userIDs...)).All(ctx)
postsByUser := sql.GroupBy(posts, func(p Post) int64 { return p.UserID })

for i := range users {
	users[i].Posts = postsByUser[users[i].ID]
}
```

Twee queries voor elk aantal gebruikers, in plaats van één per gebruiker.
