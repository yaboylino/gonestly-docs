---
title: Dev mode
description: gonestly dev rebuilds and restarts the application on every change, and stops it with a clear report when a change breaks the build, vet or tests.
---

`gonestly dev` runs your application while you work. On every save it checks the code, and the application only runs when that check passes:

```sh
gonestly dev
gonestly dev --test   # also run the tests
```

## What happens on a save

1. The application is built.
2. `go vet` checks the whole module.
3. With `--test`, the tests of the packages you changed run.

When every step passes, the running application stops gracefully and the new version starts:

```text
• internal/products/service.go changed
✓ restarted in 450ms
```

Ctrl+C stops the application the same way: it gets one interrupt and the time to finish its requests.

When a step fails, the application is **stopped**, and every problem is listed with its file, line and message:

```text
• internal/products/service.go changed
✗ the build failed, so the application was stopped:
  internal/products/service.go:45:16: s.repo.FindByIDD undefined
• fix the problem and save; the application starts again when everything passes
```

The application never keeps running an older version while the code is broken, so what answers your requests is always the code in your editor. As soon as the problem is fixed, it starts again.

## Which changes count

Only files that change the program trigger a check:

- Go files, `go.mod` and `go.sum`,
- `.env` files,
- files that a `//go:embed` pattern puts into the binary, such as [migrations](migrations) or templates.

Files the application writes itself, such as logs, uploads or a SQLite database, never cause a restart. Hidden directories, `vendor`, `node_modules` and editor scratch files are skipped. Changes that arrive together, such as a save of several files, are checked once.

## Tests

With `--test`, the tests of the packages whose files changed run on every save, and all tests run at the start. A failing test stops the application just like a compile error:

```text
✗ the tests failed, so the application was stopped:
  --- FAIL: TestCheck (0.00s)
      controller_test.go:18: status = "ok", want "fine"
```

## Flags and arguments

| Flag     | Purpose                                                                |
| -------- | ---------------------------------------------------------------------- |
| `--test` | Also run the tests of the changed packages.                            |
| `--main` | The main package, when it is not the module root, such as `./cmd/api`. |

Arguments after `--` are passed to the application: `gonestly dev -- --verbose`.

The application gets an interrupt signal when it restarts, so its [lifecycle hooks](lifecycle-events) run and running requests finish. If it does not stop within 15 seconds, it is killed. If the application exits by itself, for example because its port is in use, the dev mode reports the exit code and waits for the next change.
