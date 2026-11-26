---
title: Background jobs
description: Run work outside the request, retry it when it fails and schedule it with cron, from the database you already have.
---

Some work does not belong in a request: sending an email, resizing an image, calling a slow API, a nightly cleanup. A **job** is a named function with a payload. You enqueue it, and a worker runs it later, retries it when it fails and keeps it across restarts.

Jobs live in your database, so there is nothing else to run. They survive a crash, they run once however many instances you start, and a job enqueued inside a [transaction](transactions) exists only when that transaction commits. That last one is the transactional outbox pattern, without extra work.

> [!NOTE]
> Background jobs are available from version 0.4.0.

## Adding jobs

In a project that has a [database](database), run:

```sh
gonestly add jobs
```

It writes a migration that creates the `gonestly_jobs` table for your database, and adds the module to the root module:

```go title="internal/app/module.go"
Imports: gonestly.Imports(
	sql.ModuleFunc(...),
	jobs.Module(jobs.Options{}),
),
```

Without the CLI, create the table with the SQL from `jobs.Migration("postgres")` (or `"mysql"`, `"sqlite"`) and import the module yourself.

## Defining a job

Define a job in the constructor of the provider that owns the work. `Define` registers the handler and returns a typed `Job` to enqueue with:

```go title="internal/mail/service.go"
type Welcome struct {
	UserID int64 `json:"userId"`
}

type Service struct {
	welcome *jobs.Job[Welcome]
}

func NewService(q *jobs.Queue, mailer *Mailer) (*Service, error) {
	s := &Service{}
	var err error
	s.welcome, err = jobs.Define(q, "welcome-mail", func(ctx context.Context, w Welcome) error {
		return mailer.SendWelcome(ctx, w.UserID)
	}, jobs.MaxAttempts(5))
	return s, err
}

func (s *Service) SendWelcome(ctx context.Context, userID int64) error {
	_, err := s.welcome.Enqueue(ctx, Welcome{UserID: userID})
	return err
}
```

The payload is stored as JSON. A job runs **at least once**: when a process dies halfway, or its result cannot be written, the job runs again. Write handlers so that running twice does no harm, for example by checking whether the email was sent already.

## Enqueueing

`Enqueue` returns the id of the job. Options change one run:

| Option                  | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `jobs.Delay(time.Hour)` | Wait this long before the job can run.                                          |
| `jobs.At(t)`            | Wait until this moment.                                                         |
| `jobs.Unique("key")`    | One job with this key at a time; another `Enqueue` returns `jobs.ErrDuplicate`. |
| `jobs.Priority(10)`     | A higher number runs first.                                                     |
| `jobs.MaxAttempts(n)`   | Attempts for this run instead of the default of the job.                        |

Enqueue inside a transaction to tie the job to your data:

```go
err := db.Transaction(ctx, func(ctx context.Context) error {
	user, err := users.Create(ctx, &User{Email: email})
	if err != nil {
		return err
	}
	_, err = s.welcome.Enqueue(ctx, Welcome{UserID: user.ID})
	return err
})
```

If creating the user fails, no email job exists. If the job cannot be stored, no user is created.

## Failures and retries

A handler that returns an error is tried again, up to `MaxAttempts` (3 by default), with a growing wait: 10 seconds, doubling, up to an hour, with some randomness so retries do not arrive together. Change it per job:

```go
jobs.Define(q, "export", run,
	jobs.MaxAttempts(8),
	jobs.Timeout(10*time.Minute),
	jobs.Backoff(func(attempt int) time.Duration { return time.Duration(attempt) * time.Minute }),
)
```

- **Timeout:** the context of the handler ends after `Timeout` (5 minutes by default). Honor it.
- **Panics:** a panic is caught and counts as a failed attempt, with the stack in the error.
- **Permanent errors:** return `jobs.Permanent(err)` when a retry cannot help, such as a payload that makes no sense. The job fails at once.
- **Given up:** a job that runs out of attempts gets the status `failed` and keeps its last error. See [inspecting](#inspecting).

Inside a handler, `jobs.Current(ctx)` gives the id, the attempt and the maximum.

## Scheduling

`Schedule` enqueues a job on a cron schedule:

```go
s.cleanup, err = jobs.Define(q, "cleanup", s.run)
if err != nil {
	return nil, err
}
err = s.cleanup.Schedule("0 3 * * *", Cleanup{OlderThan: 30})
```

The five fields are minute, hour, day of the month, month and day of the week, with `*`, lists (`1,15`), ranges (`mon-fri`), steps (`*/10`) and the names of months and days. `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly` are shortcuts, and `@every 5m` runs at a fixed interval. The time zone is `Options.Location`, UTC by default.

Every instance that schedules a job tries to enqueue each run, and the database lets only one succeed. So the job runs once per moment however many instances you run, with no leader to elect. A run that is missed because every instance was down is not made up.

## Queues and scaling

Run more instances to run more jobs: workers take jobs without taking the same one twice, on PostgreSQL and MySQL with `SKIP LOCKED` and on SQLite with a single statement.

- **Concurrency:** `Options.Concurrency` jobs run at the same time in one process (4 by default).
- **Queues:** put a job on a named queue with `jobs.OnQueue("emails")`, and give a process `Options.Queues` to work on some queues only, so slow work cannot starve fast work.
- **Enqueue only:** `Options.EnqueueOnly` turns off running and scheduling in a process, for instances that only create jobs.
- **Handlers:** a process runs only the jobs it has a handler for, so you can run different sets of jobs in different processes.

## Stopping

When the application stops, the worker takes no new jobs and waits for the running ones until the shutdown timeout. A job that is still running then is cancelled and put back without using up an attempt, so another process runs it. A process that is killed without warning leaves its jobs locked until their timeout has passed, and then another process takes them over.

## Inspecting

```go
stats, _ := q.Stats(ctx)            // pending, running, done and failed
failed, _ := q.Failed(ctx, 20)      // what ran out of attempts, with the last error
err := q.Retry(ctx, failed[0].ID)   // a fresh set of attempts, starting now
```

Finished jobs are removed after `Options.Retention` (7 days), and failed ones after `Options.FailedRetention` (30 days). A `Unique` key can be used again when its job is gone.

## Testing

Enqueue jobs in a test and call `RunDue` to run everything that is due, in the current goroutine, without starting the worker:

```go
n, err := queue.RunDue(ctx)
```

It runs jobs that are due now; a job with a `Delay` or a backoff waits as in production.

## Options

| Option            | Default   | Meaning                                         |
| ----------------- | --------- | ----------------------------------------------- |
| `Concurrency`     | 4         | Jobs that run at the same time in this process. |
| `PollInterval`    | 1s        | How often the database is asked for due jobs.   |
| `Queues`          | all       | The queues this process works on.               |
| `EnqueueOnly`     | false     | Do not run or schedule jobs in this process.    |
| `Retention`       | 7 days    | How long finished jobs are kept.                |
| `FailedRetention` | 30 days   | How long failed jobs are kept.                  |
| `Location`        | UTC       | The time zone of cron expressions.              |
| `WorkerID`        | generated | Names this process in the table.                |
