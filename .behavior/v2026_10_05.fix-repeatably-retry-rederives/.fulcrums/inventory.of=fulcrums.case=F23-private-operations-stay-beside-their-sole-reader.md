# F23 — module-private transformers stay beside their sole reader

## .the fork

`isSnapshotKeyRenamed.ts` holds its exported predicate plus two private transformers
(`asKeyWithoutScopeOrdinals`, `asRegexLiteral`).

- (a) keep them private, beside the predicate
- (b) extract each to its own file

## .taken — (a)

- `rule.require.single-responsibility` bounds EXPORTS: one exported procedure per file. the
  file exports one
- each transformer has one reader; `rule.prefer.most-common-denominator` nests an operation at
  its most specific home until a second reader appears
- the predicate is covered by a caselist (`isSnapshotKeyRenamed.jest.test.ts`) that walks the
  escape cases through it

## .rework

clean — a move of two private functions.

## .confidence — 85%
