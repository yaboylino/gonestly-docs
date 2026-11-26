---
title: Voorbeeldapplicatie
description: Een complete Gonestly-applicatie om te lezen en te draaien, met twee featuremodules, een guard, transacties over modules heen en tests.
---

In de repository staat een complete applicatie die de onderdelen van deze pagina's samenbrengt: [examples/tasks](https://github.com/yaboylino/gonestly/tree/main/examples/tasks). Het is een API voor projecten met taken, op SQLite, waarin alles wat data wijzigt om een token vraagt.

## Draaien

```sh
git clone https://github.com/yaboylino/gonestly.git
cd gonestly/examples/tasks
cp .env.example .env
go run .
```

De API luistert op `localhost:3000`, en `/docs` toont elke route in Swagger UI. De database wordt aangemaakt en gemigreerd als de applicatie start.

```sh
curl -X POST localhost:3000/projects -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' -d '{"slug": "website", "name": "New website"}'
curl 'localhost:3000/tasks?project=1&done=false'
```

## Waar je moet kijken

| Waar                       | Wat het laat zien                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `internal/app`             | De root-[module](modules): [configuratie](configuration), validatie en de [database](database).              |
| `internal/auth`            | Een module met eigen configuratie die een [guard](guards) exporteert.                                        |
| `internal/projects`        | Een [repository](repositories), een getypeerde [query](queries) en een service die andere modules gebruiken. |
| `internal/tasks`           | Een module die een andere importeert, en filters die alleen gelden als ze zijn meegegeven.                   |
| `internal/app/app_test.go` | [Tests](testing) van de hele applicatie, zonder een poort te openen.                                         |
| `migrations`               | [Migraties](migrations), ingebed in de binary.                                                               |

## Een transactie over twee modules

Elk project houdt het aantal open taken bij. Een nieuwe taak moet samen worden opgeslagen en geteld, of helemaal niet, dus de takenservice doet beide in één [transactie](transactions):

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

De projectenservice weet niets van die transactie. Hij krijgt de context, en zijn query doet mee:

```go title="internal/projects/service.go"
func (s *Service) AdjustOpenTasks(ctx context.Context, id int64, delta int) error {
	result, err := s.db.Exec(ctx, "UPDATE projects SET open_tasks = open_tasks + ? WHERE id = ? AND archived_at IS NULL", delta, id)
	// ...
}
```

Is het project gearchiveerd, dan geeft `AdjustOpenTasks` een `gonestly.Conflict` terug, wordt de transactie teruggedraaid en krijgt de client een 409. Geen handler hoeft die fout te vertalen.

## Fouten zonder extra code

Het voorbeeld heeft geen code die fouten omzet in responses. Een slug die al bestaat schendt een unieke index, wat de repository meldt als `sql.ErrConflict`, een 409. Een taak voor een project dat niet bestaat is `sql.ErrNotFound`, een 404. Een request zonder token wordt door de guard gestopt met een 401, en een body die niet aan zijn `validate`-tags voldoet is een 400 die elk veld noemt.
