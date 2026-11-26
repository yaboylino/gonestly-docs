---
title: Repositories
description: Een generieke repository geeft elke tabel aanmaken, lezen, bijwerken en verwijderen op primaire sleutel, zonder SQL te schrijven.
---

`sql.Repository[T, ID]` geeft de tabel van een [model](database#modellen) de bewerkingen die elke tabel nodig heeft, op zijn primaire sleutel van type `ID`:

```go
users, err := sql.NewRepository[User, int64](db)

user := User{Name: "Ada"}
err = users.Create(ctx, &user)          // INSERT, vult user.ID en user.CreatedAt
found, err := users.FindByID(ctx, user.ID)
found.Name = "Ada Lovelace"
err = users.Update(ctx, &found)         // UPDATE op primaire sleutel
err = users.Delete(ctx, found.ID)       // DELETE op primaire sleutel
```

## Als provider

`sql.NewRepository` is een constructor die een `*sql.DB` krijgt, dus je registreert hem direct:

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

Hij controleert het model als de applicatie start: een model zonder primaire sleutel, of een primaire sleutel die het type `ID` niet kan bevatten, stopt de applicatie met een duidelijke melding.

## Methodes

| Methode                       | Wat hij doet                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `FindByID(ctx, id)`           | Geeft de rij terug, of `sql.ErrNotFound`.                                    |
| `FindAll(ctx, conditions...)` | Geeft de rijen die aan alle condities voldoen, of alle rijen.                |
| `Count(ctx, conditions...)`   | Telt de rijen die matchen.                                                   |
| `Create(ctx, &v)`             | Voegt de rij toe en vult `v` met de opgeslagen waarden.                      |
| `Update(ctx, &v)`             | Slaat elk veld op via de primaire sleutel, of geeft `sql.ErrNotFound` terug. |
| `Delete(ctx, id)`             | Verwijdert de rij, of geeft `sql.ErrNotFound` terug.                         |
| `CreateAll(ctx, values)`      | Voegt veel rijen toe in weinig statements.                                   |
| `Upsert(ctx, &v, columns...)` | Voegt de rij toe, of werkt de rij bij die zijn sleutel al heeft.             |
| `UpsertAll(ctx, values, ...)` | Voegt veel rijen toe of werkt ze bij, in weinig statements.                  |
| `Query()`                     | Start een [query](queries#de-querybuilder) op de tabel.                      |

`Create` laat een lege primaire sleutel en lege velden met `db:",default"` over aan de database en leest de opgeslagen rij terug, zodat gegenereerde ID's en tijdstempels worden ingevuld. Een primaire sleutel die je zelf zet, zoals een UUID of een code, wordt zo ingevoegd. MySQL en MariaDB kunnen alleen een auto-increment-sleutel teruggeven, dus zet elke andere sleutel daar zelf.

## Veel rijen tegelijk

`CreateAll` voegt een slice met rijen toe in zo weinig statements als de database toestaat, in één transactie: of elke rij wordt opgeslagen, of geen enkele.

```go
err := products.CreateAll(ctx, imported)
```

Hij vult de waarden niet met de opgeslagen rijen, zoals `Create` doet; vraag ze op als je de gegenereerde sleutels nodig hebt.

## Toevoegen of bijwerken

`Upsert` voegt een rij toe, of werkt de rij bij die zijn sleutel al heeft. Zonder kolommen is de sleutel de primaire sleutel; noem een of meer unieke kolommen om die te gebruiken:

```go
// Maak de instelling aan, of wijzig de waarde als hij bestaat.
err := settings.Upsert(ctx, &Setting{Name: "theme", Value: "dark"})

// Maak de gebruiker aan, of werk de gebruiker met dit e-mailadres bij.
err := users.Upsert(ctx, &user, "email")
```

`user` wordt gevuld met de opgeslagen rij, dus na een update is zijn ID het bestaande. Een update overschrijft de velden die je zet en houdt de rest: de primaire sleutel, en lege velden met `db:",default"`, zoals een aanmaaktijd. `UpsertAll` doet hetzelfde voor veel rijen, wat past bij synchroniseren met een ander systeem.

> [!NOTE]
> MySQL en MariaDB kun je niet vertellen welke kolommen beslissen: daar werkt een botsing met welke unieke sleutel van de tabel dan ook die rij bij.

## Niet gevonden is een 404

`sql.ErrNotFound` is een HTTP-fout, dus een handler kan hem direct teruggeven en de client krijgt een 404:

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

Controleer erop met `errors.Is(err, sql.ErrNotFound)` als je hem zelf wilt afhandelen, bijvoorbeeld om met `gonestly.NotFound` een specifiekere melding te geven.

## Een duplicaat is een 409

Breekt een insert of update een unieke constraint, of herhaalt hij een primaire sleutel, dan is de fout `sql.ErrConflict`. Ook dat is een HTTP-fout, dus een tweede aanmelding met hetzelfde e-mailadres geeft **409 Conflict** in plaats van een 500:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "A record with these values already exists.",
  "instance": "/users"
}
```

Controleer erop met `errors.Is(err, sql.ErrConflict)` om te zeggen welke waarde bezet is, bijvoorbeeld met `gonestly.Conflict("the email address is already in use")`. De fout van de driver blijft beschikbaar voor `errors.As`. Hetzelfde geldt voor ruwe queries en de query builder.

## Je eigen repository

Voor queries die bij één tabel horen, bed je de repository in je eigen type in:

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
