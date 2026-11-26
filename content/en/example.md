---
title: Example application
description: A complete Gonestly application to read and run, with two feature modules, a guard, transactions across modules and tests.
---

The repository holds a complete application that brings the parts of these pages together: [examples/tasks](https://github.com/yaboylino/gonestly/tree/main/examples/tasks). It is an API for projects with tasks, on SQLite, where everything that changes data asks for a token.

## Running it

```sh
git clone https://github.com/yaboylino/gonestly.git
cd gonestly/examples/tasks
cp .env.example .env
go run .
```

The API listens on `localhost:3000`, and `/docs` shows every route in Swagger UI. The database is created and migrated when the application starts.

```sh
curl -X POST localhost:3000/projects -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' -d '{"slug": "website", "name": "New website"}'
curl 'localhost:3000/tasks?project=1&done=false'
```

## Where to look

| Where                      | What it shows                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `internal/app`             | The root [module](modules): [configuration](configuration), validation and the [database](database). |
| `internal/auth`            | A module with its own configuration that exports a [guard](guards).                                  |
| `internal/projects`        | A [repository](repositories), a typed [query](queries) and a service that other modules use.         |
| `internal/tasks`           | A module that imports another one, and filters that only apply when they are given.                  |
| `internal/app/app_test.go` | [Tests](testing) of the whole application, without opening a port.                                   |
| `migrations`               | [Migrations](migrations), embedded in the binary.                                                    |

## A transaction across two modules

Every project keeps the number of its open tasks. A new task must be stored and counted together, or not at all, so the tasks service does both in one [transaction](transactions):

```go title="internal/tasks/service.go"
func (s *Service) Create(ctx context.Context, req CreateRequest) (Task, error) {
	task := Task{ProjectID: req.ProjectID, Title: req.Title}
	err := s.db.Transaction(ctx, func(ctx context.Context) error {
		if err := s.projects.AdjustOpenTasks(ctx, task.ProjectID, 1); err != nil {
			return err
		}
		return s.repo.Create(ctx, &task)
	})
	return task, err
}
```

The projects service knows nothing about that transaction. It receives the context, and its query joins in:

```go title="internal/projects/service.go"
func (s *Service) AdjustOpenTasks(ctx context.Context, id int64, delta int) error {
	result, err := s.db.Exec(ctx, "UPDATE projects SET open_tasks = open_tasks + ? WHERE id = ? AND archived_at IS NULL", delta, id)
	// ...
}
```

When the project is archived, `AdjustOpenTasks` returns `gonestly.Conflict`, the transaction rolls back and the client receives a 409. No handler has to translate that error.

## Errors without extra code

The example has no code that turns errors into responses. A slug that is taken violates a unique index, which the repository reports as `sql.ErrConflict`, a 409. A task for a project that does not exist is `sql.ErrNotFound`, a 404. A request without the token is stopped by the guard with a 401, and a body that fails its `validate` tags is a 400 that names each field.
