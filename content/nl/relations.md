---
title: Relaties
description: Declareer relaties tussen modellen en laad ze met Include, in één query per relatie, of maak een rij samen met zijn gerelateerde rijen in één transactie.
---

> [!NOTE]
> Relaties zijn beschikbaar vanaf versie 0.3.0.

Modellen die bij elkaar horen, zoals een gebruiker en zijn posts, kun je verbinden met een relatie. Een relatie is een veld dat de gerelateerde rijen bevat, met de tag `rel` en de kolom die de sleutel bevat. Laden kost één query per relatie, hoeveel rijen er ook zijn, en je zegt altijd expliciet wat er geladen moet worden: er gebeurt niets achter je rug om.

## Relaties declareren

```go title="blog/models.go"
//go:generate gonestly generate columns

type User struct {
	ID    int64  `db:"id"`
	Name  string `db:"name"`
	Posts []Post `rel:"user_id"` // de posts van deze gebruiker: posts.user_id wijst naar users.id
	Bio   *Bio   `rel:"user_id"` // de ene bio van deze gebruiker: bios.user_id wijst naar users.id
}

type Post struct {
	ID      int64     `db:"id"`
	UserID  int64     `db:"user_id"`
	Title   string    `db:"title"`
	Author  *User     `rel:"user_id"`  // de gebruiker van deze post: deze post bevat de sleutel
	Remarks []Remark  `rel:"post_id"`
}
```

De tag `rel` noemt de kolom die de sleutel bevat, en het type van het veld bepaalt de rest:

| Veldtype | Betekenis                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| `[]Post` | Heeft veel: de sleutelkolom staat in `Post` en wijst naar de primaire sleutel van dit model.                          |
| `*Bio`   | Heeft één, als de sleutelkolom in `Bio` staat; hoort bij, als dit model de kolom heeft, zoals `Author` met `user_id`. |

Een relatieveld is nooit een kolom, dus het heeft geen `db:"-"` nodig. Gebruik een pointer voor één rij, omdat die een ontbrekende rij van een lege kan onderscheiden. De sleutel wijst naar de primaire sleutel van het andere model, tenzij je iets anders zegt: `rel:"owner_code,references=code"`.

Fouten in de declaraties, zoals een sleutelkolom die niet bestaat of een sleutel van een ander soort, worden gemeld als de [repository](repositories) wordt gemaakt, dus als de applicatie start, met de namen van het model en het veld.

## Relaties laden

`gonestly generate columns` schrijft een getypeerde waarde voor elke relatie, in `<Model>Relations`. Geef ze aan `Include`:

```go
users, err := sql.From[User](db).
	Include(UserRelations.Posts, UserRelations.Bio).
	OrderBy(UserColumns.Name.Asc()).
	All(ctx)

for _, user := range users {
	fmt.Println(user.Name, len(user.Posts))
}
```

Dat zijn drie queries voor elk aantal gebruikers: één voor de gebruikers, één voor al hun posts en één voor al hun bio's. Een gebruiker zonder posts heeft een lege slice, geen `nil`, dus hij wordt in JSON `[]`. Een relatie waar je niet om vroeg blijft leeg.

### Geneste relaties

`With` laadt relaties van de gerelateerde rijen:

```go
users, err := sql.From[User](db).
	Include(UserRelations.Posts.With(PostRelations.Remarks, PostRelations.Author)).
	All(ctx)
```

Elk niveau is één query. Rijen die een ouder delen krijgen elk een kopie, dus een wijziging in de ene verandert de andere niet. Relaties kunnen naar hun eigen model wijzen, zoals de ouder en kinderen van een categorie, en zo diep genest worden als je wilt.

### Rijen die je al hebt

`Load` en `LoadAll` vullen de relaties van rijen die zonder zijn geladen:

```go
user, err := users.FindByID(ctx, 42)
err = users.Load(ctx, &user, UserRelations.Posts)

all, err := users.FindAll(ctx)
err = users.LoadAll(ctx, all, UserRelations.Bio)
```

Beide doen mee aan de [transactie](transactions) van de context, zoals elke query.

## Rijen samen aanmaken

`CreateNested` voegt een rij toe samen met de rijen in zijn relatievelden, in één transactie. Faalt er één, dan wordt er geen enkele opgeslagen:

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

- De rijen eronder krijgen de sleutel van de rij erboven: `Post.UserID` wordt voor je ingevuld.
- Een rij waar deze rij bij hoort, in een pointer zoals `Post.Author`, wordt eerst aangemaakt als hij nieuw is. Een rij is nieuw als zijn primaire sleutel nul is; een rij met een sleutel bestaat al en blijft ongemoeid, alleen zijn sleutel wordt gekopieerd.
- De hele boom wordt daarna gevuld met de opgeslagen rijen, dus gegenereerde sleutels en tijdstempels zijn er.
- Rijen die naar elkaar wijzen worden één keer aangemaakt.

Een dubbele sleutel ergens in de boom is een `sql.ErrConflict`, die een handler als 409 teruggeeft en die de relatie noemt waarin het gebeurde. Hele bomen bijwerken of verwijderen hoort hier niet bij: werk rijen bij met de repository, en laat de database gerelateerde rijen verwijderen met `ON DELETE CASCADE` op de foreign key.

## Zonder de gegenereerde waarden

De gegenereerde waarden benoemen alleen relaties. Zonder de generator maak je er een met de Go-naam van het veld:

```go
posts := sql.Relation[User, Post]("Posts")
users, err := sql.From[User](db).Include(posts).All(ctx)
```

Een naam die geen relatie van het model is geeft een fout die de relaties noemt die het wel heeft.

## Goed om te weten

- **Foreign keys blijven van jou.** Gonestly maakt de sleutels in je database niet aan; voeg ze toe in een [migratie](migrations), met `ON DELETE CASCADE` waar gerelateerde rijen met hun ouder mee moeten gaan.
- **Veel-op-veel** heeft nog geen eigen relatie. Modelleer de koppeltabel als een model met twee hoort-bij-relaties.
- **Lange lijsten met sleutels** worden in meerdere queries geladen, zodat het aantal argumenten nooit boven de limiet van een database komt.
