---
title: Transactions
description: Run work in a transaction that travels through the context, so repositories and queries take part automatically.
---

`db.Transaction` runs a function in a transaction. It commits when the function returns nil, and rolls back when it returns an error or panics:

```go
err := db.Transaction(ctx, func(ctx context.Context) error {
	if err := orders.Create(ctx, &order); err != nil {
		return err
	}
	_, err := sql.From[Product](db).
		Where(productID.Eq(order.ProductID)).
		Update(ctx, productStock.Set(product.Stock-1))
	return err
})
```

## Through the context

The transaction travels in the context that the function receives. Every [repository](repositories), [query](queries) and `db.Exec` that uses that context takes part in it, so services do not need to know whether they run inside a transaction:

```go
func (s *OrderService) Place(ctx context.Context, order *Order) error {
	return s.db.Transaction(ctx, func(ctx context.Context) error {
		if err := s.orders.Create(ctx, order); err != nil {
			return err
		}
		return s.stock.Reserve(ctx, order.ProductID) // joins the transaction
	})
}
```

> [!WARNING]
> Use the context passed to the function. A query with the outer context runs outside the transaction and cannot see its uncommitted changes.

## Nested transactions

Calling `Transaction` inside a transaction creates a savepoint. When the inner function fails, only its own work is undone, and the outer transaction can continue:

```go
err := db.Transaction(ctx, func(ctx context.Context) error {
	if err := orders.Create(ctx, &order); err != nil {
		return err
	}
	// A failed coupon does not cancel the order.
	if err := db.Transaction(ctx, func(ctx context.Context) error {
		return coupons.Redeem(ctx, order.CouponCode)
	}); err != nil {
		logger.WarnContext(ctx, "coupon not redeemed", "error", err)
	}
	return nil
})
```

## Concurrency

A transaction uses a single connection. Do not run queries on the transaction's context from several goroutines at the same time; run concurrent work outside the transaction, or one query after another inside it.
