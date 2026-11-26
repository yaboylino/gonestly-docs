---
title: Formulieren en uploads
description: Lees HTML-formulieren en geüploade bestanden in een getypeerd request met de form-tag en het type File, met een groottelimiet per route.
---

Naast JSON kan een handler een formulier ontvangen: de body die een HTML-`<form>` verstuurt, met of zonder bestanden. De tag `form` leest er een veld uit, en een veld van het type `gonestly.File` ontvangt een geüpload bestand.

## Een formulier

```go title="contact/requests.go"
type ContactRequest struct {
	Name    string   `form:"name" validate:"required"`
	Email   string   `form:"email" validate:"required,email"`
	Topics  []string `form:"topic"`
	Message string   `form:"message" validate:"required,max=2000"`
}
```

```go
gonestly.Post(r, "/contact", c.Send)
```

Formuliervelden ondersteunen dezelfde types als [queryparameters](controllers#requests-binden): strings, booleans, getallen, slices voor herhaalde velden en pointers voor optionele. Het formulier mag URL-encoded of multipart zijn; beide werken. Regels voor [validatie](validation) gelden zoals altijd, en een ongeldig veld wordt gemeld met `"in": "form"`.

Een requesttype leest zijn body uit een formulier of uit JSON, niet uit allebei. Naast `form`-velden kun je wel `path`, `query` en `header` gebruiken. Een waarde in de querystring telt nooit als formulierveld.

## Bestanden uploaden

Geef een veld het type `gonestly.File`:

```go title="photos/requests.go"
type UploadRequest struct {
	AlbumID int64           `path:"id"`
	Title   string          `form:"title"`
	Photo   gonestly.File   `form:"photo"`   // verplicht
	Thumb   *gonestly.File  `form:"thumb"`   // optioneel
	Extras  []gonestly.File `form:"extra"`   // elk aantal
}
```

| Type              | Betekenis                                                                  |
| ----------------- | -------------------------------------------------------------------------- |
| `gonestly.File`   | Een verplicht bestand; zonder krijgt de client een 400 die het veld noemt. |
| `*gonestly.File`  | Een optioneel bestand; `nil` als het niet is meegestuurd.                  |
| `[]gonestly.File` | Elk bestand dat onder die naam is verstuurd.                               |

Een bestand heeft een `Name`, een `Size` en het `ContentType` dat de client opgeeft. `Open` geeft de inhoud:

```go title="photos/controller.go"
func (c *Controller) Upload(ctx context.Context, req UploadRequest) (Photo, error) {
	file, err := req.Photo.Open()
	if err != nil {
		return Photo{}, err
	}
	defer file.Close()
	return c.service.Store(ctx, req.AlbumID, req.Title, file)
}
```

Het bestand bestaat zolang het request wordt afgehandeld, dus kopieer wat je wilt bewaren. Een request met bestanden moet `multipart/form-data` zijn; al het andere krijgt **415 Unsupported Media Type**.

> [!WARNING]
> `Name` en `ContentType` komen van de client. `Name` heeft geen map, maar gebruik hem niet als pad op schijf: kies de naam zelf. Bepaal het type uit de inhoud, bijvoorbeeld met `http.DetectContentType`, als het ertoe doet.

## De groottelimiet

De [server](http-server#configuratie) accepteert bodies tot 1 MiB, wat weinig is voor uploads. Verhoog de limiet voor de routes die het nodig hebben, en alleen voor die:

```go
gonestly.Post(r, "/albums/{id}/photos", c.Upload, gonestly.MaxBodyBytes(20<<20)) // 20 MiB
```

Een grotere body krijgt **413 Content Too Large**. Grote bestanden worden naar tijdelijke bestanden geschreven in plaats van naar het geheugen, en verwijderd als het request klaar is.

## In de API-documentatie

Een formulier staat in het [OpenAPI](openapi)-document als requestbody met zijn velden, en bestanden als binaire inhoud, zodat Swagger UI een bestandskiezer toont.

## Testen

`gonestlytest` verstuurt een URL-encoded formulier als de body `url.Values` is, en een multipart-formulier als het een `gonestlytest.Form` is:

```go
app.Post("/contact", url.Values{"name": {"Ada"}, "email": {"ada@example.com"}, "message": {"Hi"}})

app.Post("/albums/7/photos", gonestlytest.Form{
	Values: url.Values{"title": {"Sunset"}},
	Files:  []gonestlytest.FormFile{{Field: "photo", Name: "sunset.jpg", Content: jpeg}},
}).ExpectStatus(http.StatusCreated)
```
