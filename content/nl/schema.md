---
title: Schema vanuit je modellen
description: Beschrijf je tabellen één keer, in de structs van je code, en laat Gonestly de SQL-migraties schrijven en toepassen als ze veranderen.
---

Je hoeft geen SQL te schrijven om je database te wijzigen. De structs met `db`-tags zijn het schema. Wijzig er een, draai `gonestly migrate dev`, en de migratie wordt voor jouw database geschreven, met de SQL om hem ongedaan te maken, en toegepast.

> [!NOTE]
> Schemamigraties zijn beschikbaar vanaf versie 0.5.0. Migraties die je met de hand schrijft blijven ernaast werken.

## De werkwijze

```go title="internal/tracks/model.go"
type Track struct {
	ID     int64  `db:"id"`
	Title  string `db:"title"`
	Artist string `db:"artist" schema:"index"`
}
```

```sh
gonestly migrate dev
```

```text
• create_tracks:
  create the table tracks
✓ created migrations/20260401120000_create_tracks.up.sql
✓ created migrations/20260401120000_create_tracks.down.sql
✓ applied 20260401120000_create_tracks
```

Later voeg je `Slug *string` toe aan de struct en draai je hetzelfde commando. Alleen het verschil wordt geschreven:

```sql
ALTER TABLE tracks ADD COLUMN slug VARCHAR(255);
```

`gonestly generate resource` gebruikt hetzelfde mechanisme: het schrijft het model, en de migratie die zijn tabel maakt.

| Commando                             | Wat het doet                                                            |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `gonestly migrate dev`               | Schrijft de migratie voor de wijzigingen in je modellen en past hem toe |
| `gonestly migrate dev --create-only` | Schrijft hem en laat het toepassen over aan `gonestly migrate up`       |
| `gonestly migrate diff`              | Toont de SQL zonder iets te schrijven                                   |
| `gonestly migrate baseline`          | Neemt migraties over die je met de hand schreef; zie hieronder          |

`--name add_slug` geeft de migratie een naam; anders wordt de naam uit de wijzigingen gemaakt.

## Wat een model beschrijft

Een model is een geëxporteerde struct met minstens één `db`-tag, dezelfde structs die `gonestly generate columns` leest. Ingebedde structs, zoals een gedeelde `Base`, horen bij de tabel. De tabel heet zoals de methode `TableName` zegt, die een string-literal moet teruggeven, of anders het meervoud van de typenaam in snake case: `Product` is `products`.

Het Go-type bepaalt de kolom:

| Go-type                            | PostgreSQL                 | MySQL             | SQLite      |
| ---------------------------------- | -------------------------- | ----------------- | ----------- |
| `int64`, `int`, `uint64`, `uint32` | `BIGINT`                   | `BIGINT`          | `INTEGER`   |
| `int32`, `uint16`                  | `INTEGER`                  | `INT`             | `INTEGER`   |
| `int16`, `int8`, `uint8`           | `SMALLINT`                 | `SMALLINT`        | `INTEGER`   |
| `string`                           | `VARCHAR(255)`             | `VARCHAR(255)`    | `TEXT`      |
| `bool`                             | `BOOLEAN`                  | `BOOLEAN`         | `BOOLEAN`   |
| `float64`, `float32`               | `DOUBLE PRECISION`, `REAL` | `DOUBLE`, `FLOAT` | `REAL`      |
| `time.Time`                        | `TIMESTAMPTZ`              | `DATETIME(6)`     | `TIMESTAMP` |
| `[]byte`                           | `BYTEA`                    | `LONGBLOB`        | `BLOB`      |
| `json.RawMessage`, slices en maps  | `JSONB`                    | `JSON`            | `TEXT`      |

Een pointer, of `sql.NullString` en verwanten, maakt de kolom optioneel; al het andere is `NOT NULL`. Een benoemd type zoals `type Status string` wordt doorgelezen naar het onderliggende type. Een veld met de naam `ID`, of met `db:",pk"`, is de primaire sleutel, en een gehele sleutel wordt door de database gegenereerd tenzij je `noauto` toevoegt. Meerdere sleutels maken een samengestelde sleutel.

## De schema-tag

Alles wat het Go-type niet kan zeggen komt in een `schema`-tag, met opties gescheiden door komma's:

```go
type Track struct {
	ID       int64     `db:"id"`
	Title    string    `db:"title" schema:"size=200"`
	Slug     string    `db:"slug" schema:"unique"`
	Artist   string    `db:"artist" schema:"index"`
	Body     string    `db:"body" schema:"type=text"`
	Price    string    `db:"price" schema:"type=decimal(10,2)"`
	Plays    int64     `db:"plays" schema:"default=0"`
	Public   bool      `db:"public" schema:"default=true"`
	Created  time.Time `db:"created_at,default"`
}
```

| Optie                       | Betekenis                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `size=200`                  | Lengte van een stringkolom; 255 zonder.                                                                    |
| `type=...`                  | `text`, `json`, `uuid`, `bytes`, `decimal(p,s)`, `varchar(n)`, of een SQL-type, gebruikt zoals geschreven. |
| `unique`                    | Een unieke index op de kolom.                                                                              |
| `index`                     | Een index op de kolom.                                                                                     |
| `unique=naam`, `index=naam` | Velden met dezelfde naam maken één index over allemaal, in veldvolgorde.                                   |
| `default=...`               | De waarde als een insert de kolom weglaat: `now`, `true`, `false`, een getal, `'tekst'`, of `expr:SQL`.    |
| `noauto`                    | Een gehele sleutel die je zelf zet.                                                                        |
| `onDelete=...`              | Op een relatieveld: `cascade`, `restrict`, `setnull` of `noaction`.                                        |

Een `time.Time` met `db:",default"` krijgt vanzelf `default=now`.

## Relaties worden foreign keys

De [relaties](relations) die je met `rel` declareert zijn ook de foreign keys. De sleutel komt in de tabel die de kolom heeft, en wijst naar de primaire sleutel van de andere:

```go
type Post struct {
	ID       int64   `db:"id"`
	AuthorID int64   `db:"author_id"`
	Author   *User   `rel:"author_id" schema:"onDelete=cascade"`
}
```

```sql
CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
```

Declareer hem aan de ene kant, de andere, of beide: het is één sleutel. `onDelete=setnull` vraagt een optionele kolom, wat Gonestly controleert.

## Hernoemen houdt je data

Een veld dat verdwijnt terwijl er een van hetzelfde type verschijnt lijkt op een hernoeming, en een migratie die de ene kolom weggooit en de andere toevoegt verliest de data. Daarom vraagt het commando:

```text
? Did you rename column tracks.name to title? (y/N)
```

Zonder terminal, zoals in een script, zeg je het met een flag, voor een kolom of een tabel:

```sh
gonestly migrate dev --rename tracks.name=title --rename old_tracks=tracks
```

## Wijzigingen die jouw akkoord nodig hebben

Een migratie die data verwijdert, zoals een tabel of kolom droppen, of een kolom verkleinen, wordt pas geschreven als je het accepteert. In een terminal vraagt het commando het; elders geef je `--accept-data-loss` mee. De SQL van een `--create-only`-run wordt alleen geschreven, dus daar wordt het niet gevraagd.

Sommige wijzigingen falen alleen op tabellen waarvan de rijen er niet bij passen: een nieuwe verplichte kolom zonder default, een kolom die verplicht wordt, een nieuwe unieke index. Ze worden als waarschuwing getoond. De migratie draait in een transactie, dus een mislukking laat de database zoals hij was. Geef de kolom een default, of maak het veld een pointer, om het te vermijden.

Een primaire sleutel wijzigen, of of hij gegenereerd wordt, wordt niet voor je geschreven; schrijf die migratie met de hand met `gonestly migrate create`.

## Ongedaan maken

Elke migratie heeft een `down`-bestand, gemaakt uit hetzelfde verschil de andere kant op. Een gedropte kolom komt leeg en optioneel terug, omdat zijn data niet terug kan komen.

## SQLite

SQLite kan alleen een kolom toevoegen en weinig anders, dus voor de meeste wijzigingen maakt Gonestly de tabel opnieuw: hij maakt de nieuwe tabel, kopieert de rijen, dropt de oude en geeft de nieuwe de naam. De migratie zegt `-- gonestly:foreign-keys-off`, zodat de tabellen die ernaar wijzen hun rijen houden (zonder dat zou het droppen van de tabel cascaden). De foreign keys worden aan het eind gecontroleerd, en de migratie faalt als hij een rij achterliet die er een schendt.

## Een project met handgeschreven migraties overnemen

Een project waarvan de migraties met de hand zijn geschreven weet niet welk schema ze maakten, dus `gonestly migrate dev` stopt. Als de database overeenkomt met je modellen, zeg je dat:

```sh
gonestly migrate baseline
```

Dit legt de modellen vast als het schema, zonder een migratie te schrijven. Vanaf dan schrijft `migrate dev` alleen wat verandert. `gonestly generate resource` doet dit vanzelf, voor de modellen die op dat moment bestaan.

## De snapshot

Het schema dat de migraties maakten wordt bewaard in `migrations/schema.snapshot.json`. Commit het samen met de migraties: zo weet de volgende `gonestly migrate dev` het verschil, en het is voor elke database hetzelfde, dus je kunt later van SQLite naar PostgreSQL wisselen. De applicatie leest het niet.
