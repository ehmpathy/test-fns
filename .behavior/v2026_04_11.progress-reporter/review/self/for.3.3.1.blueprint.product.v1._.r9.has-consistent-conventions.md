# self-review r9: has-consistent-conventions

review for divergence from extant names and patterns.

---

## extant conventions search

### method

1. glob for `src/domain.operations/slowtestReporter/**/*.ts` → mapped directory structure
2. glob for `src/contract/*.ts` → found contract name patterns
3. grep for `^export const as[A-Z]` → found asExplicitGitOptions.ts as precedent
4. read SlowtestConfig.ts, SlowtestReporterJest.ts → verified class/interface names

### directory structure

| extant | proposed | match? |
|--------|----------|--------|
| slowtestReporter/ | progressReporter/ | ✅ yes |
| slowtestReporter/reporter/ | progressReporter/reporter/ | ✅ yes |
| slowtestReporter/output/ | progressReporter/output/ | ✅ yes |
| slowtestReporter/hierarchy/ | progressReporter/transform/ | ⚠️ different name |
| slowtestReporter/.test/assets/ | progressReporter/.test/assets/ | ✅ yes |

### file names

| extant pattern | proposed | match? |
|---------------|----------|--------|
| SlowtestReporterJest.ts (PascalCase class) | ProgressReporterJest.ts | ✅ yes |
| emitJsonReport.ts (verb + noun) | emitProgressFiles.ts | ✅ yes |
| formatTerminalReport.ts (verb + noun) | asProgressOverviewLine.ts | ⚠️ as prefix |
| buildBlockHierarchy.ts (verb + noun) | asProgressFailureLine.ts | ⚠️ as prefix |
| slowtestReporter.acceptance.jest.test.ts | progressReporter.acceptance.jest.test.ts | ✅ yes |

### contract names

| extant | proposed | match? |
|--------|----------|--------|
| slowtest.reporter.jest.ts | progress.reporter.jest.ts | ✅ yes |
| pattern: {feature}.reporter.{runner}.ts | follows pattern | ✅ yes |

---

## divergence analysis

### transform/ vs hierarchy/

**extant:** slowtestReporter uses `hierarchy/` for block hierarchy operations.

**proposed:** blueprint uses `transform/` for pure format conversion operations.

**verdict:** ✅ acceptable divergence. the subdirectory name describes content: `hierarchy/` for hierarchy build, `transform/` for format transformation. different domains warrant different names.

### `as` prefix vs verb prefixes

**extant:** slowtestReporter uses verbs: `build`, `compute`, `format`, `emit`, `evaluate`.

**proposed:** blueprint uses `as` prefix: `asProgressOverviewLine`, `asProgressFailureLine`, `asIsoDurationWords`.

**verdict:** ✅ acceptable. `as` prefix is established in codebase (`asExplicitGitOptions.ts`). the `as` prefix signals "cast to" or "format as" — appropriate for transformers that convert shapes. verb prefixes like `format` would also work, but `as` is more concise for pure conversion.

---

## name consistency check

| blueprint name | convention followed? |
|---------------|---------------------|
| ProgressReporterJest | ✅ PascalCase class, matches SlowtestReporterJest |
| ProgressConfig | ✅ PascalCase interface, matches SlowtestConfig |
| emitProgressFiles | ✅ camelCase verb+noun, matches emitJsonReport |
| asProgressOverviewLine | ✅ camelCase as+noun, matches asExplicitGitOptions |
| asProgressFailureLine | ✅ camelCase as+noun, established pattern |
| asIsoDurationWords | ✅ camelCase as+noun, established pattern |
| progress.reporter.jest | ✅ kebab-case dots, matches slowtest.reporter.jest |

---

## summary

| category | reviewed | divergent | acceptable |
|----------|----------|-----------|------------|
| directories | 5 | 1 | 1 |
| file names | 5 | 2 | 2 |
| contracts | 1 | 0 | 0 |
| operation names | 6 | 0 | 0 |

all name conventions are consistent with extant patterns or have justified divergence.

---

## non-issues

### `as` prefix instead of `format`

**questioned:** should transformers use `format` prefix like `formatTerminalReport`?

**why `as` holds:** `format` implies output preparation for display. `as` implies pure type/shape conversion. the progress transformers convert data shapes, not format for display. `asProgressOverviewLine` returns a JSON string shape, not a human-readable format.

### `transform/` subdirectory is new

**questioned:** slowtestReporter has no `transform/` directory. is this inconsistent?

**why it holds:** slowtestReporter puts transformers in `output/` (formatTerminalReport) and `hierarchy/` (buildBlockHierarchy). the blueprint separates concerns more clearly: `output/` for i/o, `transform/` for pure conversion. this is an improvement, not inconsistency.

