---
title: Queries
description: Build typed queries from columns, or write raw SQL that is scanned straight into structs.
---

Beyond [repositories](repositories), the SQL layer offers two ways to query: a typed query builder for the common cases, and raw SQL for everything else. Both scan the rows into your [models](database#models).

## The query builder

`sql.From` starts a query on the table of a model. Conditions are built from typed columns:

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

A column carries its type, so `userTeamID.Eq("1")` does not compile. Every method returns a new query, so you can build a base query once and extend it safely.

> [!HINT]
> `gonestly generate columns` writes these columns for every model in a package; see [generators](generators#typed-columns).

### Conditions

| Method                              | SQL                                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| `Eq(v)`, `Ne(v)`                    | `=`, `<>`; a nil pointer becomes `IS NULL` or `IS NOT NULL` |
| `Gt`, `Gte`, `Lt`, `Lte`            | `>`, `>=`, `<`, `<=`                                        |
| `Like(pattern)`                     | `LIKE`                                                      |
| `Between(low, high)`                | `BETWEEN`                                                   |
| `In(values...)`, `NotIn(values...)` | `IN`, `NOT IN`; an empty list matches nothing               |
| `IsNull()`, `IsNotNull()`           | `IS NULL`, `IS NOT NULL`                                    |

Conditions passed to `Where` must all match. Combine them with `sql.And`, `sql.Or` and `sql.Not`, and write what columns cannot express with `sql.Raw`:

```go
sql.From[User](db).Where(
	sql.Or(userTeamID.Eq(1), userTeamID.Eq(2)),
	sql.Raw("lower(name) = lower(?)", name),
)
```

### Results

| Method                          | Returns                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `All(ctx)`                      | Every matching row.                                     |
| `First(ctx)`                    | The first matching row, or `sql.ErrNotFound`.           |
| `Count(ctx)`                    | The number of matching rows.                            |
| `Exists(ctx)`                   | Whether a row matches.                                  |
| `Update(ctx, column.Set(v)...)` | Changes matching rows and returns how many.             |
| `Delete(ctx)`                   | Removes matching rows and returns how many.             |
| `SQL()`                         | The statement and its arguments, for logging and tests. |

`Update` and `Delete` without a condition return `sql.ErrUnsafeQuery` instead of changing the whole table. Pass `sql.Always()` when that is what you want:

```go
removed, err := sql.From[Session](db).Where(sql.Always()).Delete(ctx)
```

## Raw SQL

`sql.Query` runs your own SQL and scans every row into a model, matching columns to fields by name:

```go
users, err := sql.Query[User](ctx, db, `
	SELECT u.* FROM users u
	JOIN memberships m ON m.user_id = u.id
	WHERE m.team_id = ? AND u.created_at > ?`, teamID, since)
```

For a single value, scan into a basic type:

```go
total, err := sql.QueryOne[int64](ctx, db, "SELECT COUNT(*) FROM orders WHERE status = ?", "paid")
```

`QueryOne` returns `sql.ErrNotFound` when there is no row and `sql.ErrTooManyRows` when there is more than one. A column without a matching field is an error that names the column, so a typo never goes unnoticed. To read the result of a join or an aggregate, define a struct for it:

```go
type TeamStats struct {
	TeamID int64 `db:"team_id"`
	Users  int64 `db:"users"`
}

stats, err := sql.Query[TeamStats](ctx, db, "SELECT team_id, COUNT(*) AS users FROM users GROUP BY team_id")
```

### Placeholders

Write `?` for every argument, in every database; Gonestly rewrites it for the dialect, such as `$1` for PostgreSQL. Question marks in quoted text and comments are left alone, and `??` stands for a literal question mark, such as the `?` operator of PostgreSQL's `jsonb`.

A slice argument expands into a list, which makes `IN` queries easy:

```go
users, err := sql.Query[User](ctx, db, "SELECT * FROM users WHERE id IN (?)", []int64{1, 2, 3})
```

An empty slice is an error, because `IN ()` is not valid SQL.

## Related rows

The SQL layer never loads related rows behind your back, so there are no hidden queries. Load them with one extra query and group them with `sql.GroupBy`:

```go
posts, err := sql.From[Post](db).Where(postUserID.In(userIDs...)).All(ctx)
postsByUser := sql.GroupBy(posts, func(p Post) int64 { return p.UserID })

for i := range users {
	users[i].Posts = postsByUser[users[i].ID]
}
```

Two queries for any number of users, instead of one per user.
