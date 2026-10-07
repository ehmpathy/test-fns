# F4 — release as `fix`, not a major

## .the fork

- (a) `fix` — the old keys were a defect; a migration note names the one-pass resnap
- (b) `feat!` / major — every consumer with a repeatable snapshot must resnap

## .taken — (a)

the wish frames this as a defect close (#71) and asks for a migration note, not a major. a consumer
on a caret range takes it on next install; the ci red names the absent key, and the note names the
fix.

## .rework

clean — only the commit prefix changes.

## .confidence — 70%

semver purists would call a forced resnap a contract break. the wisher's call.

## .verdict — ruled 2026-10-05

the wisher chose `fix`: *"yes its a fix"*. the release ships as a `fix`, with a migration note
that names the key rename and the one-pass resnap.