---
title: Forms and uploads
description: Read HTML forms and uploaded files into a typed request with the form tag and the File type, with a size limit per route.
---

Besides JSON, a handler can receive a form: the body that an HTML `<form>` sends, with or without files. The `form` tag reads a field from it, and a field of type `gonestly.File` receives an uploaded file.

## A form

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

Form fields support the same types as [query parameters](controllers#binding-requests): strings, booleans, numbers, slices for repeated fields and pointers for optional ones. The form may be URL encoded or multipart; both work. [Validation](validation) rules apply as usual, and an invalid field is reported with `"in": "form"`.

A request type reads its body either from a form or from JSON, not both. Next to `form` fields you can still use `path`, `query` and `header`. A value in the query string never stands in for a form field.

## Uploading files

Give a field the type `gonestly.File`:

```go title="photos/requests.go"
type UploadRequest struct {
	AlbumID int64           `path:"id"`
	Title   string          `form:"title"`
	Photo   gonestly.File   `form:"photo"`   // required
	Thumb   *gonestly.File  `form:"thumb"`   // optional
	Extras  []gonestly.File `form:"extra"`   // any number
}
```

| Type              | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `gonestly.File`   | A required file; without it the client gets a 400 that names the field. |
| `*gonestly.File`  | An optional file; `nil` when it was not sent.                           |
| `[]gonestly.File` | Every file sent under that name.                                        |

A file has a `Name`, a `Size` and the `ContentType` the client claims. `Open` gives its content:

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

The file exists while the request is handled, so copy what you want to keep. A request with files must be `multipart/form-data`; anything else gets **415 Unsupported Media Type**.

> [!WARNING]
> `Name` and `ContentType` come from the client. `Name` has no directory, but do not use it as a path on disk: choose the name yourself. Detect the type from the content, for example with `http.DetectContentType`, when it matters.

## The size limit

The [server](http-server#configuration) accepts bodies up to 1 MiB, which is small for uploads. Raise the limit for the routes that need it, and only for those:

```go
gonestly.Post(r, "/albums/{id}/photos", c.Upload, gonestly.MaxBodyBytes(20<<20)) // 20 MiB
```

A larger body gets **413 Content Too Large**. Large files are written to temporary files instead of memory, and removed when the request is done.

## In the API documentation

A form appears in the [OpenAPI](openapi) document as a request body with its fields, and files as binary content, so Swagger UI shows a file picker.

## Testing

`gonestlytest` sends a URL encoded form when the body is `url.Values`, and a multipart form when it is a `gonestlytest.Form`:

```go
app.Post("/contact", url.Values{"name": {"Ada"}, "email": {"ada@example.com"}, "message": {"Hi"}})

app.Post("/albums/7/photos", gonestlytest.Form{
	Values: url.Values{"title": {"Sunset"}},
	Files:  []gonestlytest.FormFile{{Field: "photo", Name: "sunset.jpg", Content: jpeg}},
}).ExpectStatus(http.StatusCreated)
```
