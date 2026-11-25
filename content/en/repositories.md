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
| `Query()`                     | Starts a [query](queries#the-query-builder) on the table.        |

`Create` leaves a zero primary key and zero fields tagged `db:",default"` to the database, and reads the stored row back, so generated IDs and timestamps are filled in. A primary key you set yourself, such as a UUID or a code, is inserted as it is.

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
