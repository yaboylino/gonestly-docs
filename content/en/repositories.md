---
title: Repositories
description: A generic repository gives every table create, read, update and delete by primary key, without writing SQL.
---

`sql.Repository[T, ID]` gives the table of a [model](database#models) the operations every table needs, by its primary key of type `ID`:

```go
users, err := sql.NewRepository[User, int64](db)

user := User{Name: "Ada"}
err = users.Create(ctx, &user)          // INSERT, fills user.ID and user.CreatedAt
found, err := users.FindByID(ctx, user.ID)
found.Name = "Ada Lovelace"
err = users.Update(ctx, &found)         // UPDATE by primary key
err = users.Delete(ctx, found.ID)       // DELETE by primary key
```

## As a provider

`sql.NewRepository` is a constructor that takes a `*sql.DB`, so you can register it directly:

```go title="users/module.go"
var Module = &gonestly.Module{
	Name:        "users",
	Providers:   gonestly.Providers(sql.NewRepository[User, int64], NewService),
	Controllers: gonestly.Controllers(NewController),
}
```

```go title="users/service.go"
func NewService(users *sql.Repository[User, int64]) *Service {
	return &Service{users: users}
}
```

It checks the model when the application starts: a model without a primary key, or a primary key that cannot hold the `ID` type, stops the application with a clear message.

## Methods

| Method                        | What it does                                                     |
| ----------------------------- | ---------------------------------------------------------------- |
| `FindByID(ctx, id)`           | Returns the row, or `sql.ErrNotFound`.                           |
| `FindAll(ctx, conditions...)` | Returns the rows that match all conditions, or every row.        |
| `Count(ctx, conditions...)`   | Counts the rows that match.                                      |
| `Create(ctx, &v)`             | Inserts the row and fills `v` with the stored values.            |
| `Update(ctx, &v)`             | Stores every field by primary key, or returns `sql.ErrNotFound`. |
| `Delete(ctx, id)`             | Removes the row, or returns `sql.ErrNotFound`.                   |
| `CreateAll(ctx, values)`      | Inserts many rows in few statements.                             |
| `Upsert(ctx, &v, columns...)` | Inserts the row, or updates the one that already has its key.    |
| `UpsertAll(ctx, values, ...)` | Inserts or updates many rows in few statements.                  |
| `Query()`                     | Starts a [query](queries#the-query-builder) on the table.        |

`Create` leaves a zero primary key and zero fields tagged `db:",default"` to the database, and reads the stored row back, so generated IDs and timestamps are filled in. A primary key you set yourself, such as a UUID or a code, is inserted as it is. MySQL and MariaDB can only report an auto increment key, so set any other key yourself there.

## Many rows at once

`CreateAll` inserts a slice of rows in as few statements as the database allows, in one transaction: either every row is stored, or none.

```go
err := products.CreateAll(ctx, imported)
```

It does not fill the values with the stored rows, as `Create` does; query them when you need the generated keys.

## Insert or update

`Upsert` inserts a row, or updates the row that already has its key. Without columns the key is the primary key; name one or more unique columns to use those instead:

```go
// Create the setting, or change its value when it exists.
err := settings.Upsert(ctx, &Setting{Name: "theme", Value: "dark"})

// Create the user, or update the user that has this email.
err := users.Upsert(ctx, &user, "email")
```

`user` is filled with the stored row, so its ID is the existing one after an update. An update overwrites the fields you set and keeps the rest: the primary key, and zero fields tagged `db:",default"`, such as a creation time. `UpsertAll` does the same for many rows, which suits synchronizing with another system.

> [!NOTE]
> MySQL and MariaDB cannot be told which columns decide: there, a clash with any unique key of the table updates that row.

## Not found is a 404

`sql.ErrNotFound` is an HTTP error, so a handler can return it directly and the client receives a 404:

```go
func (c *Controller) Find(ctx context.Context, req FindRequest) (User, error) {
	return c.users.FindByID(ctx, req.ID)
}
```

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "The requested record does not exist.",
  "instance": "/users/42"
}
```

Check for it with `errors.Is(err, sql.ErrNotFound)` when you want to handle it yourself, for example to return a more specific message with `gonestly.NotFound`.

## A duplicate is a 409

When an insert or update breaks a unique constraint or repeats a primary key, the error is `sql.ErrConflict`. It is an HTTP error too, so a second sign-up with the same email address answers **409 Conflict** instead of a 500:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "A record with these values already exists.",
  "instance": "/users"
}
```

Check for it with `errors.Is(err, sql.ErrConflict)` to say which value is taken, for example with `gonestly.Conflict("the email address is already in use")`. The error of the driver stays available to `errors.As`. The same holds for raw queries and the query builder.

## Your own repository

For queries specific to a table, embed the repository in your own type:

```go title="users/repository.go"
type Repository struct {
	*sql.Repository[User, int64]
}

func NewRepository(db *sql.DB) (*Repository, error) {
	base, err := sql.NewRepository[User, int64](db)
	return &Repository{base}, err
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (User, error) {
	return r.Query().Where(userEmail.Eq(&email)).First(ctx)
}
```
