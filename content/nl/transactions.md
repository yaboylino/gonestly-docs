---
title: Transacties
description: Voer werk uit in een transactie die via de context meereist, zodat repositories en queries automatisch meedoen.
---

`db.Transaction` voert een functie uit in een transactie. Hij commit als de functie nil teruggeeft, en draait alles terug als hij een fout teruggeeft of een panic geeft:

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

## Via de context

De transactie reist mee in de context die de functie krijgt. Elke [repository](repositories), [query](queries) en `db.Exec` die die context gebruikt, doet eraan mee, dus services hoeven niet te weten of ze binnen een transactie draaien:

```go
func (s *OrderService) Place(ctx context.Context, order *Order) error {
	return s.db.Transaction(ctx, func(ctx context.Context) error {
		if err := s.orders.Create(ctx, order); err != nil {
			return err
		}
		return s.stock.Reserve(ctx, order.ProductID) // doet mee met de transactie
	})
}
```

> [!WARNING]
> Gebruik de context die de functie krijgt. Een query met de buitenste context draait buiten de transactie en ziet de nog niet gecommitte wijzigingen niet.

## Geneste transacties

`Transaction` aanroepen binnen een transactie maakt een savepoint. Faalt de binnenste functie, dan wordt alleen haar eigen werk teruggedraaid en kan de buitenste transactie verder:

```go
err := db.Transaction(ctx, func(ctx context.Context) error {
	if err := orders.Create(ctx, &order); err != nil {
		return err
	}
	// Een mislukte kortingscode annuleert de bestelling niet.
	if err := db.Transaction(ctx, func(ctx context.Context) error {
		return coupons.Redeem(ctx, order.CouponCode)
	}); err != nil {
		logger.WarnContext(ctx, "coupon not redeemed", "error", err)
	}
	return nil
})
```

## Gelijktijdigheid

Een transactie gebruikt één verbinding. Voer geen queries tegelijk uit op de context van de transactie vanuit meerdere goroutines; doe gelijktijdig werk buiten de transactie, of voer de queries binnen de transactie na elkaar uit.
