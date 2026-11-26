---
title: Relations
description: Declare relations between models and load them with Include, in one query per relation, or create a row together with its related rows in one transaction.
---

> [!NOTE]
> Relations are available from version 0.3.0.

Models that belong together, such as a user and their posts, can be connected with a relation. A relation is a field that holds the related rows, tagged `rel` with the column that holds the key. Loading them takes one query per relation, however many rows there are, and you always say explicitly what to load: nothing happens behind your back.

## Declaring relations

```go title="blog/models.go"
//go:generate gonestly generate columns

type User struct {
	ID    int64  `db:"id"`
	Name  string `db:"name"`
	Posts []Post `rel:"user_id"` // the posts of this user: posts.user_id points at users.id
	Bio   *Bio   `rel:"user_id"` // the one bio of this user: bios.user_id points at users.id
}

type Post struct {
	ID      int64     `db:"id"`
	UserID  int64     `db:"user_id"`
	Title   string    `db:"title"`
	Author  *User     `rel:"user_id"`  // the user of this post: this post holds the key
	Remarks []Remark  `rel:"post_id"`
}
```

The `rel` tag names the column that holds the key, and the type of the field tells the rest:

| Field type | Meaning                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `[]Post`   | Has many: the key column is in `Post`, and points at the primary key of this model.                                    |
| `*Bio`     | Has one, when the key column is in `Bio`; belongs to, when this model has the column, as `Author` does with `user_id`. |

A relation field is never a column, so it needs no `db:"-"`. Use a pointer for a single row, because it can tell a missing row from an empty one. The key points at the primary key of the other model unless you say otherwise: `rel:"owner_code,references=code"`.

When both models have the key column, as with a parent in the same table or a profile that shares the primary key of its user, a pointer is ambiguous and the application refuses to start until you add `,belongs` (this model holds the key) or `,has` (the other model does):

```go
Parent *Topic `rel:"parent_id,belongs"`
```

Mistakes in the declarations, such as a key column that does not exist or a key of another kind, are reported when the [repository](repositories) is created, so when the application starts, with the names of the model and the field.

## Loading relations

`gonestly generate columns` writes a typed value for every relation, in `<Model>Relations`. Pass them to `Include`:

```go
users, err := sql.From[User](db).
	Include(UserRelations.Posts, UserRelations.Bio).
	OrderBy(UserColumns.Name.Asc()).
	All(ctx)

for _, user := range users {
	fmt.Println(user.Name, len(user.Posts))
}
```

That is three queries for any number of users: one for the users, one for all their posts and one for all their bios. A user without posts has an empty slice, not `nil`, so it encodes as `[]` in JSON. A relation you did not ask for stays empty.

### Nested relations

`With` loads relations of the related rows:

```go
users, err := sql.From[User](db).
	Include(UserRelations.Posts.With(PostRelations.Remarks, PostRelations.Author)).
	All(ctx)
```

Every level is one query. Rows that share a parent get a copy each, so changing one does not change another. Relations can point at their own model, such as the parent and children of a category, and be nested as far as you like.

### Rows you already have

`Load` and `LoadAll` fill the relations of rows that were loaded without them:

```go
user, err := users.FindByID(ctx, 42)
err = users.Load(ctx, &user, UserRelations.Posts)

all, err := users.FindAll(ctx)
err = users.LoadAll(ctx, all, UserRelations.Bio)
```

Both take part in the [transaction](transactions) of the context, like every query.

## Creating rows together

`CreateNested` inserts a row together with the rows in its relation fields, in one transaction. If one of them fails, none is stored:

```go
user := User{
	Name: "Ada",
	Bio:  &Bio{About: "Mathematician"},
	Posts: []Post{
		{Title: "Engines", Remarks: []Remark{{Text: "great"}}},
		{Title: "Notes"},
	},
}
err := users.CreateNested(ctx, &user)
```

- The rows below get the key of the row above: `Post.UserID` is filled in for you.
- A row that this row belongs to, in a pointer such as `Post.Author`, is created first when it is new. A row is new when its primary key is zero; one with a key is taken to exist and is not touched, only its key is copied.
- The whole tree is filled with the stored rows afterwards, so generated keys and timestamps are there.
- Rows that point at each other are created once.

A duplicate key anywhere in the tree is an `sql.ErrConflict`, which a handler returns as a 409 and which names the relation it happened in. Updating and deleting whole trees is not part of this: update rows with the repository, and let the database delete related rows with `ON DELETE CASCADE` on the foreign key.

## Without the generated values

The generated values only name relations. Without the generator, create one with the Go name of the field:

```go
posts := sql.Relation[User, Post]("Posts")
users, err := sql.From[User](db).Include(posts).All(ctx)
```

A name that is not a relation of the model is an error that lists the relations it has.

## Good to know

- **Foreign keys stay yours.** Gonestly does not create the keys in your database; add them in a [migration](migrations), with `ON DELETE CASCADE` where related rows must go with their parent.
- **Many to many** has no relation of its own yet. Model the join table as a model with two belongs to relations.
- **Large lists of keys** are loaded in several queries, so the number of arguments never gets over the limit of a database.
