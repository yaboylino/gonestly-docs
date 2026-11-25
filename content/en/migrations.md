---
title: Migrations
description: Change the schema with versioned SQL files that are applied when the application starts, each in its own transaction.
---

Migrations are plain SQL files that change the schema step by step. Gonestly applies the pending ones when the application starts, in order, each in its own transaction, and records them in the `gonestly_migrations` table.

## Writing migrations

Each migration is a pair of files with a version and a name in lower case:

```text
migrations/
  0001_create_users.up.sql
  0001_create_users.down.sql
  0002_add_user_email.up.sql
  0002_add_user_email.down.sql
  migrations.go
```

```sql title="migrations/0001_create_users.up.sql"
CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql title="migrations/0001_create_users.down.sql"
DROP TABLE users;
```

The `.down.sql` file reverts the migration and is optional. Versions are numbers: a counter such as `0001` or a timestamp such as `20261125143000` both work, as long as each version is unique.

Embed the files in your binary, so they ship with it:

```go title="migrations/migrations.go"
package migrations

import "embed"

//go:embed *.sql
var Files embed.FS
```

## Applying them at startup

Pass the files to the [database module](database), and pending migrations are applied before any provider uses the database:

```go
sql.Module(sql.Options{Driver: "pgx", DSN: dsn, Migrations: migrations.Files})
```

Every applied migration is logged. If one fails, its transaction is rolled back, the application does not start and the error names the migration.

## Safety checks

Gonestly refuses to migrate when the files and the database disagree:

| Situation                                            | Message                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| An applied migration was edited                      | `migration 1_create_users was changed after it was applied; add a new migration instead`          |
| An applied migration's file is gone                  | `migration 1_create_users is applied but its file is missing`                                     |
| A new migration is older than the latest applied one | `migration 2_x is pending but the newer migration 3 is already applied; give it a higher version` |
| A file name does not follow the pattern              | `create_users.up.sql does not follow <version>_<name>.up.sql or .down.sql`                        |

A checksum of every applied file is stored, so an edit is detected even when the version stays the same. On PostgreSQL an advisory lock makes sure that two instances starting at the same time do not migrate at once.

## The migrator

For your own tooling, `sql.NewMigrator` gives direct control:

```go
migrator, err := sql.NewMigrator(db, migrations.Files)
applied, err := migrator.Up(ctx)       // apply every pending migration
reverted, err := migrator.Down(ctx)    // revert the latest applied migration
status, err := migrator.Status(ctx)    // every migration and whether it is applied
```

The CLI will offer the same through `gonestly migrate`.
