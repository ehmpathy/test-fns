# F18 — the vitest esm import gap ships as a known, dreamed gap

## .the fork

under vitest esm, `import { useThen, useBeforeAll } from 'test-fns'` resolves both to
`undefined`: the module exports `then`, so the dynamic import is a thenable and settles to a
subset (`limitation.esm-thenable-then-export`).

- (a) ship #71 with the gap known and dreamed; fix it in its own change
- (b) fix it here

## .taken — (a)

- prior to this change, on `main`; this change neither causes nor widens it
- #71 is about the retry; a vitest-via-cjs or jest consumer gets the full fix today
- the fix touches the package's export surface (the thenable shim), a contract change with its
  own blast radius

dream: `.dream/2026_10_06.vitest-esm-import-drops-usethen.dream.md`.

## .for the wisher

a reviewer asks for a conscious human "yes, ship with this known gap". this row is that ask,
surfaced at the fulcrum council.

## .rework

dirty — the export surface is the package contract.

## .confidence — 80%

## .verdict

ruled by wisher 2026-10-07: (a). ship #71 with the gap documented (readme `createRequire`
workaround); fix the export surface in its own change.
