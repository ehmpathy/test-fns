# F11 — prior shapes the diff touches but does not author, left as found

## .the fork

- (a) leave prior shapes as they were on `main`
- (b) rework them in this fix

## .the points

- `setThenTest.testFn: ... | ((cb: any) => void) | null` — the type of the `then` body that
  `castToTestInput` returns on `main`; `then` passed it through untouched before. narrow it
  and `TestInput` narrows with it, a public type
- `usePrep`'s `let toolbox` and `delete proxyHandler.get` — on `main` as is; this fix adds
  the SOME catch around `setup()` and no new mutation
- `getOneRunnerVersion` — moved from `genTempDir/autoprune/` to `infra/isomorph.test/` so the
  repeatably readers can share it (`rule.prefer.most-common-denominator`); its body is
  unchanged

## .taken — (a)

each is a refactor of behavior this fix does not change. `rule.prefer.scouts-honor` bounds the
cleanup: a public type change or a hook rework rides badly on a `fix` release.

## .rework

clean — each is a separate, local change.

## .confidence — 85%
