# self-review r12: has-role-standards-adherance

review for adherance to mechanic role standards.

---

## method

1. enumerated all briefs/ subdirectories in mechanic role
2. identified which are relevant to blueprint content
3. opened blueprint (3.3.1.blueprint.product.v1.i1.md)
4. read blueprint lines 1-267
5. for each blueprint section, checked against relevant rules
6. noted violations and non-issues

---

## rule directories checked

enumerated briefs/ subdirectories relevant to this blueprint:

| directory | relevance | checked? |
|-----------|-----------|----------|
| practices/lang.terms/ | name conventions, ubiqlang | ✅ |
| practices/lang.tones/ | lowercase, buzzwords | ✅ |
| practices/code.prod/evolvable.architecture/ | bounded contexts, directional deps | ✅ |
| practices/code.prod/evolvable.domain.objects/ | domain object rules | ✅ |
| practices/code.prod/evolvable.domain.operations/ | operation grain rules, verbs | ✅ |
| practices/code.prod/evolvable.procedures/ | input-context, arrow-only | ✅ |
| practices/code.prod/evolvable.repo.structure/ | no barrel exports, directional deps | ✅ |
| practices/code.prod/pitofsuccess.errors/ | failfast, failloud | ✅ |
| practices/code.prod/pitofsuccess.procedures/ | idempotent procedures | ✅ |
| practices/code.prod/readable.comments/ | what-why headers | ✅ |
| practices/code.prod/readable.narrative/ | narrative flow, no decode friction | ✅ |
| practices/code.test/ | coverage by grain, given-when-then | ✅ |

---

## blueprint line-by-line review

### lines 12-42: filediff tree

**checked against:** rule.require.directional-deps, rule.forbid.barrel-exports

```
src/
├── domain.objects/
│   └── [+] ProgressConfig.ts
├── domain.operations/
│   └── progressReporter/
│       ├── reporter/
│       │   └── [+] ProgressReporterJest.ts
│       ├── output/
│       │   └── [+] emitProgressFiles.ts
│       └── transform/
└── contract/
    └── [+] progress.reporter.jest.ts
```

**findings:**
- ✅ no index.ts files declared (no barrel exports)
- ✅ domain.objects → domain.operations → contract (correct direction)
- ✅ single file per codepath (no co-located utilities)

### lines 47-52: ProgressConfig

**checked against:** rule.forbid.undefined-attributes, rule.forbid.nullable-without-reason

```
ProgressConfig
├── [+] dir: string   # required: output directory path
```

**findings:**
- ✅ dir is required string, not optional
- ✅ no nullable attributes without reason
- ✅ simple interface, one field

### lines 56-100: ProgressReporterJest

**checked against:** rule.require.what-why-headers, rule.require.failfast, rule.require.idempotent-procedures

```
ProgressReporterJest implements Reporter
├── private state
│   ├── [+] passed: number
│   ├── [+] failed: number
│   ...
├── [+] constructor(_globalConfig, options?)
│   ├── validate dir is provided
│   ├── create directory if absent
│   └── initialize state
```

**findings:**
- ✅ constructor validates dir (failfast on absent config)
- ✅ ensureDir called in constructor (directory created before use)
- ✅ private state uses typed numbers (not any)
- ✅ Reporter interface implemented correctly

### lines 103-111: asProgressOverviewLine

**checked against:** rule.require.input-context-pattern, rule.forbid.inline-decode-friction

```
asProgressOverviewLine
├── [+] input: { passed, failed, skipped, remains, outof, durationMs }
└── [+] output: string (json line)
    ├── format duration as ISO 8601 via asIsoDurationWords
    └── return JSON.stringify({ passed, failed, skipped, remains, outof, duration })
```

**findings:**
- ✅ input is named object (not positional args)
- ✅ delegates duration format to asIsoDurationWords (no inline decode friction)
- ✅ pure transformer (no side effects)

### lines 113-124: asProgressFailureLine

**checked against:** rule.require.input-context-pattern, rule.forbid.inline-decode-friction

```
asProgressFailureLine
├── [+] input: { testResult, testCaseResult }
└── [+] output: string (json line)
    ├── path = testResult.testFilePath (relative)
    ├── suite = ancestorTitles.join(' › ') + ' › ' + title
    ├── failure = failureMessages.join('\n')
    ├── stdout = console entries where type='log', truncate to 10kb
    ├── stderr = console entries where type='warn'|'error', truncate to 10kb
```

**findings:**
- ✅ input is named object
- ✅ operations are descriptive (ancestorTitles.join, failureMessages.join)
- ✅ truncate logic documented inline (acceptable for transformer spec)
- ✅ console separation is explicit

### lines 127-135: asIsoDurationWords

**checked against:** rule.prefer.read-package-docs-before-use, rule.require.named-transformers

```
asIsoDurationWords
├── [+] input: { milliseconds: number }
└── [+] output: IsoDurationWords (e.g., 'PT2M34S')
    ├── [←] use iso-time getDuration to get shape
    └── [←] use iso-time format to convert to words
```

**findings:**
- ✅ reuses iso-time package (not custom implementation)
- ✅ [←] markers show reuse intent
- ✅ named transformer with as prefix

### lines 137-152: emitProgressFiles

**checked against:** rule.require.get-set-gen-verbs, rule.require.idempotent-procedures

```
emitProgressFiles
├── [+] appendOverviewLine({ dir, line })
├── [+] appendFailureLine({ dir, line })
├── [+] writeSummary({ dir, summary })
└── [+] ensureDir({ dir })
```

**findings:**
- ✅ append* for jsonl files (correct for append-only)
- ✅ write* for summary (correct for overwrite)
- ✅ ensureDir with recursive: true (idempotent mkdir)
- ✅ all inputs are named objects

### lines 162-172: coverage by layer

**checked against:** rule.require.test-coverage-by-grain

| layer | codepath | test type | expected | match? |
|-------|----------|-----------|----------|--------|
| transformer | asProgressOverviewLine | unit | unit | ✅ |
| transformer | asProgressFailureLine | unit | unit | ✅ |
| transformer | asIsoDurationWords | unit | unit | ✅ |
| orchestrator | ProgressReporterJest | acceptance | integration/acceptance | ✅ |
| contract | progress.reporter.jest | acceptance | acceptance | ✅ |

**findings:**
- ✅ transformers tested with unit tests (pure functions)
- ✅ orchestrator tested via acceptance (reporter requires jest runtime)
- ✅ contract tested via acceptance (blackbox)

---

## standards check

### lang.terms standards

#### rule.require.treestruct

**blueprint check:** file names follow [verb][...noun] pattern.

| name | pattern | adherant? |
|------|---------|-----------|
| ProgressConfig | [...noun] | ✅ domain object |
| ProgressReporterJest | [...noun][type] | ✅ domain object |
| emitProgressFiles | [verb][...noun] | ✅ emit = verb |
| asProgressOverviewLine | [as][...noun] | ✅ as prefix for transformer |
| asProgressFailureLine | [as][...noun] | ✅ as prefix for transformer |
| asIsoDurationWords | [as][...noun] | ✅ as prefix for transformer |
| appendOverviewLine | [verb][...noun] | ✅ append = verb |
| appendFailureLine | [verb][...noun] | ✅ append = verb |
| writeSummary | [verb][...noun] | ✅ write = verb |
| ensureDir | [verb][...noun] | ✅ ensure = verb |

**adherant:** ✅ all names follow treestruct pattern.

#### rule.require.ubiqlang

**blueprint check:** terms are consistent and unambiguous.

| term | usage | consistent? |
|------|-------|-------------|
| progress | reporter name, file prefix | ✅ |
| overview | heartbeat line type | ✅ |
| failure | failed test line type | ✅ |
| summary | final state json | ✅ |
| heartbeat | interval emission | ✅ |
| dir | directory config | ✅ |

**adherant:** ✅ no synonym drift, no overloaded terms.

### code.prod/evolvable.architecture standards

#### rule.require.bounded-contexts

**blueprint check:** progressReporter is self-contained bounded context.

```
domain.operations/progressReporter/
├── reporter/      # orchestrator
├── output/        # communicator
└── transform/     # transformers
```

**adherant:** ✅ reporter/ contains orchestrator, output/ contains i/o, transform/ contains pure functions. context is bounded.

#### rule.require.directional-deps

**blueprint check:** dependencies flow downward.

| from | to | direction |
|------|----|-----------|
| contract/progress.reporter.jest | domain.operations/progressReporter | ↓ |
| ProgressReporterJest | emitProgressFiles | ↓ |
| ProgressReporterJest | asProgressOverviewLine | ↓ |
| ProgressReporterJest | asProgressFailureLine | ↓ |
| asProgressOverviewLine | asIsoDurationWords | ↓ |

**adherant:** ✅ no upward imports, no circular dependencies.

### code.prod/evolvable.domain.operations standards

#### define.domain-operation-grains

**blueprint check:** operations have correct grain.

| operation | grain | justification |
|-----------|-------|---------------|
| ProgressReporterJest | orchestrator | composes transformers + communicators |
| emitProgressFiles | communicator | fs i/o boundary |
| asProgressOverviewLine | transformer | pure json format |
| asProgressFailureLine | transformer | pure json format |
| asIsoDurationWords | transformer | pure duration format |

**adherant:** ✅ grains correctly assigned.

#### rule.require.get-set-gen-verbs

**blueprint check:** operations use correct verbs.

| operation | verb | pattern |
|-----------|------|---------|
| appendOverviewLine | append | write operation (acceptable variant of set) |
| appendFailureLine | append | write operation (acceptable variant of set) |
| writeSummary | write | write operation (acceptable variant of set) |
| ensureDir | ensure | idempotent create (acceptable variant of gen) |
| asProgressOverviewLine | as | transformer prefix |
| asProgressFailureLine | as | transformer prefix |
| asIsoDurationWords | as | transformer prefix |

**adherant:** ✅ verbs are semantic and consistent.

### code.prod/evolvable.procedures standards

#### rule.require.input-context-pattern

**blueprint check:** procedures follow (input, context?) pattern.

| procedure | input arg | context arg |
|-----------|-----------|-------------|
| asProgressOverviewLine | { passed, failed, skipped, remains, outof, durationMs } | none (pure) |
| asProgressFailureLine | { testResult, testCaseResult } | none (pure) |
| asIsoDurationWords | { milliseconds } | none (pure) |
| appendOverviewLine | { dir, line } | none (fs only) |
| appendFailureLine | { dir, line } | none (fs only) |
| writeSummary | { dir, summary } | none (fs only) |
| ensureDir | { dir } | none (fs only) |

**adherant:** ✅ all inputs are named objects.

#### rule.require.arrow-only

**blueprint check:** blueprint declares functions, not classes.

| construct | type | adherant? |
|-----------|------|-----------|
| ProgressReporterJest | class | ✅ (jest Reporter requires class) |
| asProgressOverviewLine | const arrow | ✅ |
| asProgressFailureLine | const arrow | ✅ |
| asIsoDurationWords | const arrow | ✅ |
| appendOverviewLine | const arrow | ✅ |
| appendFailureLine | const arrow | ✅ |
| writeSummary | const arrow | ✅ |
| ensureDir | const arrow | ✅ |

**adherant:** ✅ class only where required by jest Reporter interface.

### code.prod/pitofsuccess.errors standards

#### rule.require.failfast

**blueprint check:** errors fail fast with clear messages.

| scenario | approach |
|----------|----------|
| absent dir config | validate dir is provided → throw |
| nested dir absent | ensureDir with recursive: true |

**adherant:** ✅ config validation fails fast.

### code.prod/readable.narrative standards

#### rule.forbid.inline-decode-friction

**blueprint check:** orchestrator (ProgressReporterJest) delegates to named operations.

| orchestrator action | delegation |
|--------------------|------------|
| format overview line | → asProgressOverviewLine |
| format failure line | → asProgressFailureLine |
| format duration | → asIsoDurationWords |
| write overview | → appendOverviewLine |
| write failure | → appendFailureLine |
| write summary | → writeSummary |

**adherant:** ✅ orchestrator composes named operations, no inline computation.

### code.test standards

#### rule.require.test-coverage-by-grain

**blueprint check:** test types match grain.

| grain | codepath | declared test | correct? |
|-------|----------|---------------|----------|
| transformer | asProgressOverviewLine | unit | ✅ |
| transformer | asProgressFailureLine | unit | ✅ |
| transformer | asIsoDurationWords | unit | ✅ |
| orchestrator | ProgressReporterJest | acceptance | ✅ |
| contract | progress.reporter.jest | acceptance | ✅ |

**adherant:** ✅ transformers get unit tests, orchestrator/contract get acceptance tests.

---

## summary

| category | rules checked | violations |
|----------|--------------|------------|
| lang.terms | 2 | 0 |
| evolvable.architecture | 2 | 0 |
| evolvable.domain.operations | 2 | 0 |
| evolvable.procedures | 2 | 0 |
| pitofsuccess.errors | 1 | 0 |
| readable.narrative | 1 | 0 |
| code.test | 1 | 0 |
| **total** | **11** | **0** |

blueprint adheres to all mechanic role standards. no violations found.

---

## non-issues

### emitProgressFiles uses "append" not "set"

**questioned:** rule.require.get-set-gen-verbs specifies get/set/gen, but blueprint uses "append".

**why it holds:** "append" is a semantic variant of "set" for write operations. fs.appendFile is the correct primitive for jsonl stream output. the verb accurately describes the operation: append line to file. this is clearer than "setProgressFiles" which implies overwrite.

### ProgressReporterJest is a class

**questioned:** rule.require.arrow-only forbids function keyword, but ProgressReporterJest is a class.

**why it holds:** jest Reporter interface requires a class constructor. the jest test runner instantiates reporters via `new Reporter(globalConfig, options)`. this is an external API constraint, not a style choice.

### communicators (emitProgressFiles) have no context arg

**questioned:** rule.require.input-context-pattern expects (input, context?) but emitProgressFiles functions take only input.

**why it holds:** these are thin wrappers around fs/promises. no injectable dependencies are needed — fs is a standard library. the pattern allows optional context, and fs-only operations need none.

### transformers have no tests for negative cases

**questioned:** code.test standards suggest positive/negative/edge cases, but transformer tests show only positive and edge.

**why it holds:** transformers receive typed input from the orchestrator. invalid input is a type error caught at compile time. negative tests would verify typescript's type system, not the code logic.

