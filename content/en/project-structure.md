---
title: Project structure
description: Organize Gonestly apps by feature, with conventions for DTOs, typed constants, controllers, services, tests, and migrations.
---

Organize your application by feature. Put products in `internal/products` and orders in `internal/orders`. Each feature owns its routes, business logic, and API types. Avoid application-wide `controllers/`, `services/`, and `dto/` folders.

## Recommended layout

```text
shop/
  main.go
  go.mod
  go.sum
  Makefile
  .env.example
  .editorconfig
  .vscode/
    settings.json
  internal/
    app/
      module.go
      config.go
      logger.go
    health/
      module.go
      controller.go
      controller_test.go
    products/
      module.go
      controller.go
      controller_test.go
      service.go
      service_test.go
      model.go
      status.go
      columns_gen.go
      dto/
        create_product.go
        update_product.go
        product_response.go
  migrations/
    migrations.go
    20261126100000_create_products.up.sql
    20261126100000_create_products.down.sql
    schema.snapshot.json
```

## Where things go

| Place                           | Responsibility                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `main.go`                       | Start the application with the root module. Keep feature logic out of it.                          |
| `internal/app/`                 | Wire features and infrastructure together. Keep application configuration here.                    |
| `module.go`                     | Register the feature's controllers and providers. Export only what other modules need.             |
| `controller.go`                 | Declare routes, pass input to the service, and return the API response.                            |
| `service.go`                    | Own business rules and coordinate database operations.                                             |
| `model.go` and `columns_gen.go` | Keep the persistence model and generated typed columns together. Do not edit generated columns.    |
| `dto/`                          | Keep HTTP request and response types here, including binding and validation tags.                  |
| `*_test.go`                     | Put tests next to what they cover: route tests by controllers and business-rule tests by services. |
| `migrations/`                   | Keep numbered SQL migrations at the project root, separate from feature code.                      |

## DTOs and typed constants

See [request and response DTOs](dtos) for a complete example of how Gonestly binds input, validates it, and writes a JSON response.

Use names such as `dto.CreateProductRequest`, `dto.UpdateProductRequest`, and `dto.ProductResponse`. A response DTO lets you choose which fields leave the application. Keep feature types with a fixed set of values in the feature package, such as `Status` and its typed constants in `products/status.go`.

Keep imports flowing in one direction: `products` can import `products/dto`, but `dto` must not import `products`. Use a string in the DTO, check it with [validation rules](validation), and convert it to `Status` in the feature package. A Go type conversion does not check whether the value matches a constant. Use lowercase package names without separators, such as `orderitems` for order items.

```go title="internal/products/status.go"
package products

type Status string

const (
	StatusDraft  Status = "draft"
	StatusActive Status = "active"
)
```

```go title="internal/products/dto/create_product.go"
package dto

type CreateProductRequest struct {
	Name   string `json:"name" validate:"required,max=200"`
	Status string `json:"status" validate:"required,oneof=draft active"`
}
```

## Start from the CLI

The [resource generator](generators#a-resource) starts with a flat feature package and groups request types in `requests.go`. When you split a feature's API types into `dto/`, move those definitions and update the controller, service, and tests that reference them. Avoid creating empty folders.

Keep database access in the feature. The generated service uses Gonestly's generic [repository](repositories); add a feature-local `repository.go` only if you need custom data access worth separating. To share functionality between features, import the other [module](modules) and use a provider it explicitly exports.

Keep feature-specific guards and interceptors with their feature. If several features need the same authentication guard, give it a named owner such as `internal/auth` and export it from that module.
