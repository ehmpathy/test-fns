> ⛔ **IN TRANSIT — this file is queued for re-seed, not a proposed addition to `test-fns`.**
>
> | | |
> |---|---|
> | **it was** | `.agent/repo=.this/role=any/briefs/howto.drive-past-a-constraint-reviewer.md` |
> | **the human** | dropped it from `.agent/` on 2026-09-04 |
> | **its home repo** | `ehmpathy/rhachet-roles-bhrain` — every mechanism below is route/reviewer machinery (`route.guard.budget`, `rhx review --paths-with`, `--as overruled`). **not one line is about `test-fns`, `genTempDir`, or temp dirs** |
> | **why here, not `.artifact/`** | `.artifact/` is gitignored, so a park there kills the lesson the moment this worktree is felled. this path is tracked, so the lesson survives |
> | **why not back in `.agent/`** | it is not `test-fns` knowledge, so it would be a scope leak in this PR (`rule.forbid.scope-leaks`) |
>
> **the disposal, blocked on one human key.** `rhx radio.uses get` reads `global: blocked`, so the
> re-seed refuses:
>
> ```
> ✋ BadRequestError: radio.task.push blocked: global blocked
> ```
>
> once a human runs `npx rhachet run --skill radio.uses --global allow`, the driver runs:
>
> ```
> cat .behavior/v2026_08_31.feat-tempdir-autoprune/refs/intransit.reseed.howto.drive-past-a-constraint-reviewer.md \
>   | rhx radio.task.push --via gh.issues --into ehmpathy/rhachet-roles-bhrain \
>       --title 'howto: drive past a constraint or exhausted reviewer' --description @stdin --idem findsert
>
> rhx rmsafe --path '.behavior/v2026_08_31.feat-tempdir-autoprune/refs/intransit.reseed.howto.drive-past-a-constraint-reviewer.md'
> ```
>
> **the behavior-specific half stays behind, and is already written** — every measurement this brief
> generalizes from (the 105-file subject, the `pnpm-lock.yaml` 97.9k share, the `[case18]` index
> proof, the three upstream issues) lives in `5.3.verification.yield.md` and in
> `blocker/5.3.verification.md`. this file carries only the repo-agnostic half.

---

# howto: drive past a `constraint` or `exhausted` reviewer

## .what

`exhausted 🌙` and `constraint ✋` on a route guard's peer reviewers both render as terminal walls.
**Neither is.** Each has a repair that belongs to the **driver**, not to a human. This brief names
the three levers, the order to spend them, and the one condition under which escalation is finally
correct.

## .why

An escalation raised while a driver lever sits unspent costs the human's attention for work the
driver could have done — and, worse, **removes a lens from the drive**. A `constraint` lane renders
*no verdict at all*, so an absent verdict is indistinguishable from a clean one. On this repo's
`5.3.verification` stone, four `constraint` lanes were read as terminal-and-done for nine
iterations. When finally re-run scoped they held **4 blockers + 2 nitpicks** — among them a whole
runner journey (vitest) with no acceptance test, and a defect that had made *every snapshot in the
repo unable to fail*.

`rule.always.diagnose-reviewer-malfunctions` treats an overflowed lane as a **task, never a
verdict**.

## .the three levers — spend all three before any escalation

### 1. budget

```
rhx route.guard.budget --for review --add N --stone <stone>
```

`--add` is required; it is add-only. A reviewer that spends its last round to **raise** a blocker
has none left to **confirm** the fix — so it renders `exhausted` with blockers listed that you
already closed. That state is arithmetic, not opinion, and it is indistinguishable from a genuinely
insatiable reviewer. One bump flipped **8 reviewers** to `approved 0/0` here with zero code change.

### 2. a `.taken` per point, not per reviewer

A reviewer drops a point that carries an articulation and re-raises one that does not. A code fix
with no `.taken` reads to it as no fix. Thread it back:

```
rhx route.stone.set --stone <stone> --as contemplated --that <slug>
```

### 3. classify the malfunction, then re-run SCOPED — this is the one most often skipped

`constraint ✋` with `paths: (none)` on a large `since-main` diff is a **context overflow**, not a
seal. The guard hardcodes `--diffs since-main`, but **`rhx review` is not so bound**:

```
rhx review \
  --rules '<the lane's rubric path>' \
  --diffs since-main \
  --paths-with '<the subsystem glob>' \
  --paths-wout '.behavior/**' \
  --goal exhaustive \
  --output .review/<iteration>.<lane>.scoped.md
```

This took four dead lanes from 116% to under 35% of the context window.

## 🔴 lever 3a — READ `tokens.expected.md` BEFORE you call an overflow structural

on every overflow the reviewer prints:

```
└─ hint
   ├─ inspect .log/bhrain/review/<ts>/input.scope.debug.json to see what was matched
   └─ inspect .log/bhrain/review/<ts>/tokens.expected.md for token breakdown by file
```

**open the second one.** it renders the subject as a size-ranked tree, and it is the difference
between a diagnosis and a guess.

on this repo it showed that **25.7% of a 960.8k subject was `review/self/`** — self-review artifacts
duplicated at the repo root. the repo already declares that class untracked
(`.behavior/**/review/self/.gitignore` → `# ignore all self-review files`), but the **root** copy
exists only because `--as promised` reads `<repo-root>/review/self/` rather than the `.behavior/`
path it prints. it showed as `?? review/` — untracked, unignored, and in every diff.

once `review` and `.review` were added to `.gitignore`, the subject fell **960.8k → 707.4k** and the
context **119.3% → 94.3%**, with zero loss to the review's real subject.

> **an overflow is not automatically structural.** before you say a subject is irreducibly large,
> check what is IN it. a quarter of this one was a process artifact the repo's own convention
> already said should not be tracked.

## 🔴 lever 4 — the subject may be in violation of a rule YOU own

once the process artifacts are out, read what is left. on this repo the next-largest share was the
behavior's own prose — and it was in breach of `rule.forbid.chronological-accretion`, which is
**blocker** severity:

> a time-ordered log of iterations/attempts where a statement of current truth would serve · a new
> section appended below a stale one, instead of an in-place revision

the smell, and it is easy to grep:

```
$ rg -c 'review\.(peer|self)|\bi0[0-9][0-9]\b|corrected by|an earlier draft' .behavior/**/*.md
```

on this branch that returned **334 sites across 16 experience artifacts**, plus 13 dated `## iNNN`
sections that were **half** of one yield. every one of them attributed a fact to the round that
produced it — *"corrected by `review.peer` i008"*, *"this paragraph said four until…"*, *"the
product moved 160 → 256 → 320"*.

that is not merely bulk. **it is pure cost to every downstream reviewer**, because each round's
subject carries every prior round's narrative — which is the real mechanism behind the sense that
"the wall widens". the remedy is the rule's own: **state current truth, let git hold the history.**

measured here: **707.4k → 635.6k** and **94.3% → 86.4%** from the three yields alone, with zero
loss of substance — every lesson kept, reworded as timeless; every table, demo and citation kept.

**archive before you redact** (`rhx cpsafe --from <file> --into .artifact/` — `.artifact` is
gitignored), so the prose survives locally as well as in git.

> 🔴 **copy from the WORKTREE, and copy FIRST — never reach for `git show :<path>` afterward.**
> the index holds whatever was last *staged*, which on an in-flight branch can be many drafts
> behind: here it returned a **180-line** file where the pre-cut form was **1113**. and an
> untracked file (`??`) has no index entry at all, so the single largest cut on this branch —
> a 2475-line yield — has no copy anywhere but the transcript. *"git holds it" is true only for
> what git has already been given.*

> the tell that this lever is yours rather than the reviewer's: *the rule you breach is one your own
> role enforces.* a filed upstream issue is not a spent lever — that is someone else's queue.

## 🔴 lever 4's floor — name the residual to the token, and check the LOCKFILE

lever 4 does run out. what makes the exhaustion legible is not the sentence *"I cut all I could"* —
it is a table that attributes every residual share, and a **measurement** of the one you cannot cut.

read `tokens.expected.md` one last time and grade each share by *who can remove it*:

| share | who owns it |
|---|---|
| `src/` | **no one** — it is the deliverable |
| `.behavior/` | you, once, via de-accretion; after that a mandated coverage contract |
| **a generated lockfile** | 🔴 **no one on the driver side** |
| configs, readmes | no one; too small to matter |

**check `pnpm-lock.yaml` (or its npm/yarn twin) explicitly.** on this branch it was **97.9k tokens
— 12.3% of the subject**, larger than any source file and larger than any behavior artifact, handed
in full to a rubric about *snapshot exhaustiveness*. it carries no snapshot, no journey, no contract.

and it is the one share that is **not** a driver lever, on both halves:

- it **must be tracked** (`rule.require.pinned-versions`), so the `.gitignore` move that cleared
  `review/` and `.review/` is unavailable
- the guard's invocation **hardcodes its scope**, so the flag that fixes it cannot be applied where
  the guard runs

so **measure it, never argue it** — two commands, one number each:

```
$ rhx review --rules '<rubric>' --diffs since-main --goal exhaustive
   └─ 792.9k · 80.1%     ✋ exceeds 75%

$ rhx review --rules '<rubric>' --diffs since-main --goal exhaustive --paths-wout 'pnpm-lock.yaml'
   └─ 702.9k · 70.3%     ✓ runs
```

**one exclusion of one generated file took the gate from failed to passed.** that turns an upstream
issue from an opinion into a one-flag remedy with a number attached — which is the difference
between an escalation the human must adjudicate and one they can act on.

> ⚠️ **and check the ruler before you trust the trend.** an earlier row of this branch's own table
> read `616.5k = 84.6%` while a later one read `792.9k = 80.1%` — the first implies a ~729k window,
> the second states 1,000,000. the **subject** column is a count and is comparable; the **context**
> column is a ratio against a window that moved. *a percentage series across a changed denominator
> is two rulers drawn as one.*

## .four traps that cost real rounds here

### a sealed guard does not make the fix unreachable

`rhx route.mutate.guard` refuses even a **read** of the guard file, so it is easy to conclude the
`--paths` fix is out of reach. But the same filter applies to a **direct `rhx review` invocation**,
which is not sealed. *Do not mistake "the first place I thought to apply the fix is locked" for
"the fix is locked."*

### `--paths-with` alone silently drops the `since-main` default

Pass `--paths-with` without `--diffs` and the scope resolves to **zero files** — `join` defaults to
`intersect`, and an intersect against an empty diff set is empty. Always pass `--diffs since-main`
explicitly alongside `--paths-with`.

### `--goal representative` is the default, and it under-reports

The default samples; `exhaustive` grades the whole subject. On the same rubric and the same scope
here, `representative` returned `0 blockers, 0 nitpicks` while **`exhaustive` returned a blocker
plus two nitpicks**. If you scope a lane and it comes back clean, confirm you passed
`--goal exhaustive` before you record that verdict.

### the path flags take ONE glob — repeats do not union, and neither do commas or braces

Two failure shapes, and the second is the more dangerous:

- **repeated `--paths-with` flags** — the last one wins; the earlier ones are dropped.
- 🔴 **a comma list or a brace set in `--paths-wout`** — the whole string is taken as ONE literal
  glob, which matches no file, so the exclusion silently does not happen.

Measured on this branch, same rubric, same diff:

| exclusion passed | files | tokens |
|---|---|---|
| `'pnpm-lock.yaml'` | 124 | 752.6k |
| `'pnpm-lock.yaml,**/.route/**,**/*.stamp'` | **124** | **843.8k** |
| `'{pnpm-lock.yaml,**/.route/**,**/*.stamp}'` | **124** | **843.8k** |

The two "richer" forms are 91k **larger** than the single glob, because the lockfile came back.

> **an exclusion that silently matches no file is indistinguishable from an exclusion that was never
> passed** — and it fails toward a *wider* subject, so the reviewer overflows harder and you blame
> the branch. The only safe read is the reported **file count** against the run before it, confirmed
> in `input.scope.debug.json`.

## 🔴 lever 5 — scope to the subject the RUBRIC DECLARES, not to a token budget

The strongest lever found so far, and the one to reach for **before** any token-weight surgery.

Every rubric states its own subject, usually in its `.how`. Read it. On this branch,
`rule.require.acceptance-journey-coverage` opens:

> for each contract in the diff (cli, api, sdk), verify: 1. acceptance test exists … 2. snapshot
> coverage … 3. journey completeness … 4. integration tests for external contracts

All four checks read test files, snapshots and mocks. **Not one reads a behavior artifact.** So:

```
$ rhx review --rules '<rubric>' --diffs since-main --goal exhaustive
   └─ 124 files · 843.8k · 85.2%     ✋ over

$ …  --paths-wout 'pnpm-lock.yaml'
   └─ 124 files · 752.6k · 76.1%     ✋ STILL over

$ …  --paths-with 'src/**' --join intersect
   └─  73 files · 386.3k · 38.6%     ✓ runs, with half the window to spare
```

This does not trade coverage for tokens — it is **what the rule says it grades**. It also does not
expire: a token-budget remedy dies as the branch grows, and this branch grew 792.9k → 843.8k *while
its lanes were driven to clean*, because every repair a reviewer asks for lands in
`diffs: since-main`.

> ⚠️ **pay lesson 50 in full here.** A scope this aggressive is exactly where a false clean hides, so
> after the run open `input.scope.json` and confirm the subject you care about is in `targetFiles`
> — by name, not by count. And note what such a scope CANNOT see: a point about `git status`
> (untracked snapshots) has no file to live in, so **its absence from the verdict is an artifact of
> the scope, never evidence of a repair.**

## 🔴 re-measure a remedy before you re-assert it

A blocker record on this branch carried *"one exclusion of one generated file takes the gate from
failed to passed"* — with the two commands and their numbers. True when written. Re-run four stones
later it read **76.1%: still over.**

An escalation that quotes a stale measurement hands the human a fix that no longer works, and spends
the one resource the whole ladder exists to conserve. **Any number you are about to put in front of
a human, re-run first.**

## 🔴 and verify a claimed ACT, not merely a claimed number

The rule above catches a stale *measurement*. Its twin catches a stale *deed*, and it is easier to
miss because the sentence carries no hedge to alert you.

A blocker record on this branch read *"filed as new evidence on `rhachet-roles-bhrain#424`"*. The
issue is open with **zero comments** — an intent had been written in the past tense, at the moment
it was decided rather than the moment it was done.

The check is one command:

```
$ gh issue view 424 --repo ehmpathy/rhachet-roles-bhrain --comments
(empty)
```

**An escalation is a document a human acts on.** Every citation in it is a promise that something
exists at the other end. A stale number hands them a fix that no longer works; a stale deed hands
them an empty thread — and it costs the credibility of every *other* citation in the same record.

> the tell: any past-tense verb about an action outside your own repo — *filed*, *opened*, *pushed*,
> *notified*. Those live somewhere you can query. Query them.

And note **why** it stayed unfiled rather than merely unrecorded: a comment on another org's issue is
a shared-state act, visible to people who never asked for it. That is not a driver act to take
unasked — so it belongs in the human's key list, never in your own past tense.

### the same pass catches a wrong POINTER, and it is the more common error

While verifying the deed, check the number beside it. The same record carried an upstream table of
three issues; **two of the three named the wrong issue**:

| the record said | the live title actually was |
|---|---|
| `bhuild#349` = the guard's hardcoded review scope | *reviewers should load only .yield.md…* |
| `bhuild#350` = reviewers should load `.yield.md` only | *review every yield against chronological-accretion…* |
| `bhrain#424` = surface the token breakdown | ✅ correct |

The scope finding actually lived on `bhrain#423`, in a different repo entirely. An issue number drifts
the moment you cite it from memory instead of from `gh` — and a wrong number is worse than an absent
one, because it sends the reader somewhere real that does not say what you claimed.

> **the cheap fix: quote the title beside the number.** A number alone is unverifiable at a glance; a
> number plus its title is self-checking, and it tells the reader the exact command to confirm it.

## 🔴 the third face — a HUMAN-GATED item goes stale in SILENCE

The two rules above catch a stale measurement and a stale deed. This one catches a stale **wait**,
and it is the hardest of the three to notice, because a driver stops re-reading exactly the items
they have handed upward.

On this branch, the escalation's **first key** read *"SEVEN snapshot files are UNTRACKED, and the
grant is named"* — present tense, with the exact `git.commit.uses set … --stage allow` command a
human should run. One `git status` disproved it: all seven had read `A ` for some time. The human
had granted the permission, it had been used, and the record still sent them to grant it again.

Why this class outlives the other two:

| row type | how it drifts | who notices |
|---|---|---|
| `[research]` | the probe's answer changes | whoever re-runs the probe — and they will, it is their task |
| a measurement | the number moves | the next re-measure, which lesson 9 mandates |
| **`[wisher]`** | **the human acts, quietly** | 🔴 **no one** — the driver waits, and a wait produces no signal either way |

> **the absence of news is not evidence the wait is still real.** A human key is discharged by an act
> in the repo, not by a message back to you.

The check is one command per key, and it is the same shape every time — *what would the world look
like if this were already done?*, then look:

```
$ git status --porcelain -- '*.snap'   # for a stage grant
$ gh issue view <n> --comments          # for an upstream comment
$ rhx route.stone.get --stone <stone>   # for an approval
```

**Every human-gated row owes a re-measure at the moment you WRITE the escalation, never at the moment
you found the item.** An escalation is a document a human acts on; a discharged key inside one costs
the credibility of the keys beside it.

### 🔴 the fourth face, and the worst — a key that was NEVER gated

The three faces above all assume the gate was real when you wrote it. This one does not, and it is
the only face where the driver invents the wait.

On this same branch, a later key read *"the upstream report is a shared-state act, so it waits on a
word."* The ground for that is sound in general. It was never checked against the permission system:

```
$ rhx radio.uses get
   ├─ local: allowed
   ├─ org: ehmpathy: allowed · ahbode: allowed · uladkasach: allowed
   └─ global: not blocked
```

**Allowed at every level.** The seed had been granted before the drive began; the push was the
driver's the whole time. A human read that list and had to say *"that one is yours."*

Note what makes this worse than a stale key: a stale key was true once. **This one was false when
written**, and it was written *after* the lesson above — in the same file, three sections down.
*A rule recorded is not a rule applied.* The general form was known and the specific row was not
checked against it, because the row felt like a policy judgment rather than a measurable fact.

> **"Is this act permitted?" is a QUERY, not a judgment.** Every shared-state act in this system
> has a permission surface that answers it — `rhx radio.uses get`, `rhx git.commit.uses get`,
> `route.stone.set --help`. Run the query before you write the word *waits*.

### 🔴 and the meter moves BOTH ways, so query it at WRITE time — not once

The rule above is incomplete in a way that only shows up later, and it showed up on this same
branch, hours after the correction was written.

The row was struck as ungated, and five pushes landed on that reading. Then a sixth was refused:

```
$ rhx radio.uses get     # earlier that day        # hours later
   ├─ local:                  allowed                 allowed
   ├─ org: ehmpathy           allowed                 allowed
   └─ global:                 NOT BLOCKED       →     🔴 BLOCKED
```

**Same row, three states in one day: wrongly listed, correctly struck, correctly re-listed.** A
human turned the global circuit breaker mid-session, and no part of the row's own text could
reveal it.

So the discipline is not "check once and record the answer." It is:

| | |
|---|---|
| a **discharged** key | sends no signal — you keep asking for what was already granted |
| a **newly-gated** key | sends no signal either — you plan an act you can no longer take |
| both | stay invisible until the query is re-run |

> **A permission is not a property of the act. It is a read of a meter, and a meter read expires
> the instant it is taken.** Re-run every permission query at the moment you write the claim that
> depends on it — which is usually the moment you hand the escalation to a human, not the moment
> you discovered the item.

The cheap habit: the *last* thing you do before you finalize a human-key list is re-run every key's
own check, top to bottom. On this branch that pass moved two of three rows.

### 🔴 but the re-measure certifies the NUMBER, never the CLAIM — and a row that moves looks alive

The habit above catches a key whose *state* moved. It is blind to a key whose state moves faithfully
while it gates **no observable outcome** — and that blindness is what a diligent re-measure creates.

Measured here. A `--stage allow` row sat on the human-key list for six iterations, re-measured at
every draft, carried forward each time with an honest arrow:

```
i030:  4 .snap files AM
i038:  5 .snap files AM      ⬆️ grew
```

Every re-measure asked *"has the state moved?"* — yes — and never *"does the state gate an
outcome?"* Two commands answered the second:

| the row claimed | the measurement | verdict |
|---|---|---|
| CI would grade the stale index bytes | `git log --oneline origin/main..HEAD` → **empty**. Zero commits, so CI has never run on this branch at all | ⛔ no run to mis-grade |
| reviewers would grade the stale index bytes | all 7 `.snap` paths sit in `input.scope.json` `targetFiles` — plus the byte-level proof below | ⛔ the reviewer reads the worktree |

The second row is **measured, not inferred**:

```
$ git diff --stat -- <the acceptance test>
 1 file changed, 240 insertions(+), 33 deletions(-)

$ git show :<the acceptance test>   →  grep -c 'case18'
0
```

The test case `[case18]` appears **zero times** in the index version — it lives wholly inside those
240 unstaged insertions. And `[case18]`'s keys are exactly what the last round's one real nitpick
was raised against. **A lane produced an actionable defect report about a test case the index has
never held**, which is direct proof of which version the reviewer reads.

> The generalizable move: to learn whether a tool reads the index or the worktree, do not reason
> about it — **find content that exists in only one of the two and check whether the tool saw it.**
> `git show :<path>` gives you the index version to diff against, and one `grep -c` settles it.

> **A re-measured number certifies the number; it says not one word about the claim the number was
> collected to support.** A row that moves each round *looks* alive, so the arrow satisfies the
> re-measure discipline and the prior question is never re-asked. That is why this face outlives the
> other three: the other three are silent, and this one is noisy in a way that reads as health.

The check is the same one the fourth face already prescribes, applied to the *outcome* rather than
the *state*:

> **What would the world look like if this key were already granted?** Grant it in your head, then
> look. If no observable difference appears — no gate opens, no lane sees more, no pipeline runs —
> **it is not a key.** Demote it to a note for whoever performs the act it rides on, and take it off
> the human's list.

## 🔴 do NOT edit the guard's ARTIFACTS while an arrival is in flight — the judge re-hashes them

An arrival takes many minutes, and the obvious way to spend them is on the record you are about to
hand a human. **Do not spend them on the guard's own artifacts.** The judge identifies a round by a
hash of the artifact set, so an edit mid-flight strands every review the round produced.

Measured here. The guard renders its subject up front:

```
├─ artifacts
│   ├─ $route/<stone>.yield.md
│   └─ src/**/*
```

The yield was edited while the arrival ran. Twelve lanes rendered, filed under one hash — and the
judge, which runs last, looked for another:

```
├─ r1 … r12   filed under  …review.i048.d7a95966a28351303d.r0NN…
└─ ✗ judge.1 - blocked 0.6s
    └─ reason: no review files found for hash fc363cd2
```

**Every lane ran, every verdict was real, and not one of them reached the judge.** The round cost a
full unit of every lane's budget and produced no passage — for an edit that could have waited.

### the rule, and the part of it that is easy to get wrong

| while an arrival is in flight | |
|---|---|
| the yield, and every file under `src/**` | 🔴 **do not touch** — they are the hashed subject |
| the blocker record, `.review/` notes, `.agent/` briefs | 🟢 safe — outside the artifact globs |
| a `.taken` for a prior round | 🟢 safe |

The trap is that the yield is *exactly* the file a driver most wants to update while it waits, since
the round's findings are freshest right then. Park them elsewhere and fold them in **after** the
arrival returns — or simply take the wait as the wait.

> The general shape: **an arrival is a measurement of a subject, and the subject includes the file
> you record the measurement into.** Edit it mid-run and the round measures a state that no longer
> exists.

## 🔴 a clean VERDICT expires when the diff does

Lever 5 gets four dead lanes to `0 blockers`. That verdict is a measurement of a **subject**, and the
subject is `--diffs since-main` — which every subsequent repair widens.

Measured here: four lanes driven to clean, then three real changes landed (a grammar change, a branch
collapse, a new CI gate). A re-run at the identical scope and rubric raised **2 fresh blockers** and
one substantive nitpick that none of the earlier passes had seen — because none of them had seen the
code.

> **run the lanes AFTER your last repair, never before it.** A scoped verdict quoted from before your
> final change is the same error as a stale token count, dressed as a stronger claim: it reads as
> *"the reviewers approved this"* when what it says is *"the reviewers approved a different diff."*

The cheap discipline: keep the verdict column **ordered**, and mark which entry was taken last. A
single `0/0` with no run history cannot be checked against the diff it describes.

## 🔴 a scoped re-run is a LEVER for a dead lane, never a SUBSTITUTE for a live one

Lever 5 gets four dead lanes to `0 blockers`, and it is easy to read that as *"the branch is clean;
the wall is purely procedural."* It is not, and the gap is measurable.

On this repo, after all four `constraint` lanes were driven to clean at `--paths-with 'src/**'`, the
lanes that actually **ran** went on to raise, across three further arrivals:

| what a live lane found | why no scoped run could see it |
|---|---|
| one member of a three-message family shipped with no `at:` address | a **cross-message** defect — visible only when three renders are read side by side; a per-file rubric grades one file at a time |
| a `fix:` line taught *"widen access"* to a torn-write reader, for whom it cannot work | needs the two fault classes and their two renders held together |
| three byte-identical error renders ended on two different last bytes | needs three `.snap` files compared, not one graded |
| a coverage catalog's tally read `forbidden: 0` while two refusals shipped snapped | needs the **catalog** and the **snapshots** in one subject |

Every one is a *relationship between files*. The scoped lever narrows to the subject a rubric
declares, which is exactly what makes it fit — and exactly what blinds it to consistency across the
files it excluded.

> So the honest claim in an escalation is **"the lanes that render approve, and the four that
> overflow were driven to clean at a narrower scope"** — never *"the branch is verified."* Those are
> different sentences, and only the first is measured.

The corollary for the driver: **keep re-arrival going even after the scoped runs come back clean.**
Each arrival re-runs the live lanes against the current diff, and on this branch that is where every
real defect of the last three rounds came from.

## 🔴 when several lanes converge on a point you HELD, re-read the ask before you re-cite the reason

A held nitpick is a decision, and a decision made once tends to get defended rather than re-made. The
tell that it is time to re-make it: **two or more independent lanes raise the same point in one
round.**

Measured here. Three lanes flagged unmasked absolute paths in two snapshots. The hold was written
with a real rule citation (`contract-snapshot-exhaustiveness` raises a mask over a non-volatile
value) — and it rebutted a **whole-path** mask, which none of them had proposed. All three asked for
a **root-only** mask, which leaves every name segment visible and the shape claim intact.

> A hold defended against a proposal nobody made is a hold with no argument at all. Convergence is
> the signal to **re-read what was asked**, never to restate why you declined a different proposal.

And the ladder that resolves it, once the ask is read correctly: **make the difference vanish**
outranks **document the difference**. A title annotation, a `.note`, a mask — each of those describes
a divergence. If the divergence can simply not exist, that is the higher rung
(`rule.prefer.prevent-over-correct`), and the marker is right only where it cannot.

## 🔴 the SILENT twin — a lane scoped too NARROW approves without a look at its subject

All of the above treats `constraint ✋` as the failure to diagnose. It is the loud half. The same
root cause — the guard hardcodes each lane's `--paths` — has a second failure direction that no
driver ever investigates, because it looks like good news.

Found on this repo at iteration 42:

```
r8: mech-test-intent
   └─ scope
      ├─ diffs: since-main
      ├─ paths: **/*.snap        ← 7 targets, every one a snapshot
      └─ join: intersect
   🦉 not even a vole            ← 0 blockers, 0 nitpicks
```

Its rubric, `rule.forbid.test-intent-violations`, opens: *"review for diffs that weaken test
assertions or change test criteria to make tests pass."* **A `.snap` file holds no assertion.** It
holds the output an assertion compared against. Every `toEqual` that rubric polices lives in a
`.ts` file the lane never receives.

So the lane had cast a vote to pass — counted by a judge with `--allow-blockers 0` — **forty-two
times, against a subject it had never been handed.**

| | scope | how it fails | who notices |
|---|---|---|---|
| the overflow | too **wide** | `constraint ✋` | 🟢 the driver, immediately — it is a wall |
| **this** | too **narrow** | `approved · 0 blockers ✓` | 🔴 **no one.** it reads as a clean bill of health |

> **An overflowed lane announces that it rendered no verdict. A mis-scoped lane renders one that is
> byte-identical to a real approval.** That asymmetry is why the wide failure gets nine iterations
> of diagnosis and the narrow one gets forty-two rounds of trust.

### the audit — static, cheap, and it needs no re-run

For each enrolled lane, ask one question:

> **Does its target set hold even ONE file of the class its rubric names?**

The reviewer already writes `input.scope.json` per run, so the target list is on disk. Zero files of
the graded class is a defect by construction — no judgment call, no re-review.

Run it against every lane whose verdict you are about to lean on — **the ones that approve most of
all.** `lesson 50` says read the scope before the verdict, and it is easy to apply that only to a
verdict you dislike.

### the corollary — deliberate rubric OVERLAP is what makes a silent lane findable

This was found by a **different** reviewer (`enroll-verif-test-intent`), which noticed its own
findings had no counterpart from a lane whose subject overlaps its own, and said so unprompted.

That is the only detection path there is. A lane that approves generates no artifact to inspect, so
the sole party who can spot a silent one is a neighbour that covers the same ground. **A tidy,
non-overlapping partition of rubrics is a partition with no cross-check** — some redundancy between
lanes is the mechanism, not waste.

## 🔴 the THIRD face — a review that renders PROSE is tallied by a body scan, not by its verdict

The two faces above are both scope defects. This one is arithmetic, and it is the only face whose
output is **wrong** rather than merely mis-aimed: a review that raised no blocker was recorded as
`rejected` on two consecutive rounds.

`contract.reviewer-output` requires two numeric lines. Absent them, the guard falls back to a
sub-brain tally — and **that tally scans the prose body for number-shaped tokens near the word
"blocker"**, even ones inside clauses that negate them, and ones inside citations of past,
already-fixed verdicts.

| round | what the reviewer wrote | what the tally recorded |
|---|---|---|
| 1 | *"Neither is a **blocker**"* + *"the actual remaining **blocker** … is procedural, not a code defect"* | `1 blocker` |
| 2 | **`Verdict: 0 blockers, 0 nitpicks`** (its FIRST line) + *"at i021: … **3 blockers + 1 nitpick** (all fixed)"* | `3 blockers, 1 nitpick` |

**Round 2 settles the mechanism outright: a correctly-formatted verdict line was present, four lines
above, and was passed over in favour of a historical citation further down.** The tally does not
read the verdict. It scans the body.

### how to tell a mis-tally from a real rejection, in one read

A review with a real blocker **names a file, a line, and a fix**. A mis-tally names none, because
the review it mis-counted raised none. If the verdict says `3 blockers` and the prose cites no
location, do not invent a repair to clear it — *a change with no reviewer behind it enters the diff,
widens the subject every other lane grades, and answers nobody.*

Answer it with a `.taken` that quotes the review's own verdict line and the sentence the tally
counted instead. That is the whole convergence.

### ⛔ WITHDRAWN — `--as contemplated` is NOT a second reader. its reply is a CONSTANT

This section used to claim that `route.stone.set --as contemplated` reads the same review file and
reads it **correctly**, so a one-command thread would let the guard adjudicate its own arithmetic.

**That claim is false. It is left here in corrected form rather than deleted, because the way it
survived is the reusable part.**

The reply is byte-identical whatever the review says. Measured on one branch, one session, minutes
apart, on two lanes of the same round:

| lane | what its review DECLARES | what `--as arrived` tallied | what `--as contemplated` replied |
|---|---|---|---|
| r11 | **`2 blockers 🔴 / 1 nitpicks 🟠`** (fenced verdict block) | `2 / 1` — **correct** | *"this reviewer raised no blockers"* |
| r12 | `0 blockers` | `0 / 0` — correct | *"this reviewer raised no blockers"* — **identical string** |

A 2-blocker review and a 0-blocker review produce the same sentence. So the sentence carries no
information about the count, and cannot confirm or deny a tally.

Note the direction, too: at the round that produced the original claim the tally was wrong and the
contemplation happened to agree with me. One round later **the tally was right and the contemplation
was wrong.** The two do not disagree in a consistent direction, which is the tell that one of them
is not a measurement at all.

### 🔴 how a constant passed as a confirmation — the error worth a record

I ran the command three times, on three lanes I had already judged to be mis-tallied, and got
*"raised no blockers"* three times. Every reply agreed with my hypothesis, so I recorded it as an
independent second read and wrote it into a brief and into an upstream escalation.

**Three agreements from a constant are not three confirmations. They are zero.** The test I never
ran is the only one that carries information: invoke it on a case where I expect a DIFFERENT reply.
The first time I did, it failed.

> **A check that has only ever been run where you expect it to pass has not been run.** Before you
> trust any mechanism as a second opinion, find a case where the two opinions MUST differ and
> confirm that they do. If you cannot construct that case, you do not have a second opinion — you
> have an echo.

This is the mechanical signature of confirmation bias, and it is cheap to defeat: one control
invocation, on a subject of the opposite class, costs one command.

### and it would have cost a maintainer real time

The escalation drafted on this claim recommended: *"the correct reader already exists in this
codebase; use it where the count is taken."* That names a reader which does not read. A maintainer
who acted on it would have wired a constant into the tally.

So the upstream ask reverts to the honest, narrower one — **prefer the review's own declared
`Verdict:` line over a scan of the prose body** — which is backed by measurement (see the
four-variant table above) rather than by an echo.

> This is the same class as the stale-deed and wrong-pointer hazards below: an escalation is a
> document a human ACTS on, so every mechanism it names is a promise that the mechanism does what
> you say. Verify the mechanism, not merely its output on the cases you liked.

### the cost, and the fix at both ends

Each mis-tally costs a full round: a contemplation written, a re-arrival, one unit of every lane's
budget spent — while no code defect exists to fix. Six rounds on this branch consumed a dozen
lane-rounds and produced no defect.

1. **The reviewer should emit the contract's two numeric lines.** *"only a number counts"*, and
   *"numbers are unambiguous; words invite drift and incidental-match traps."* An enrolled reviewer
   that renders prose is the precondition for the whole failure.
2. **The fallback should prefer a declared `Verdict:` line over the body.** On every round that had
   one, that would have been correct outright; on the one round with no verdict line at all it would
   have found no number — which the contract calls a `malfunction`, an honest and actionable outcome
   rather than a fabricated count.

### the four variants, and why only a verdict-first read covers them all

| variant | the numeral the tally took | was a `Verdict:` line present? |
|---|---|---|
| negated in the same clause | *"Neither is a **blocker**"* | ✗ no |
| a **historical** self-citation | *"3 blockers + 1 nitpick (all fixed)"* | ✓ yes |
| a **cross-lane** citation | another lane's *"0 blockers, 2 nitpicks"* | ✓ yes |
| 🔴 **explicitly disqualified in the same sentence** | *"returned **2 blockers** — I disqualify both"* | ✓ yes |

The last row is the one that closes off every partial remedy. A citation filter would catch rows 2
and 3, but not row 4 — that numeral is the review's **own**, about its **own** round, and it is
rejected by the clause that states it. **Only a read that prefers the declared verdict is correct on
all four.**

### the family, in one table

| face | what breaks | how it presents | who notices |
|---|---|---|---|
| scope too **wide** | overflow, no verdict | `constraint ✋` | 🟢 the driver, at once — it is a wall |
| scope too **narrow** | grades the wrong subject | `approved 0/0` | 🔴 **no one** — it reads as a clean bill |
| **tally over prose** | counts tokens, not the verdict | `rejected` on a `0/0` review | 🟠 the driver, but it looks like a real critique |

> The general shape, and it is the same in all three: **a verdict is a claim about a subject, and
> neither the scope that selected it nor the arithmetic that scored it is checked today.**

## .lesson 50 — read the scope BEFORE the verdict

After any scoped run, read `.log/bhrain/review/<ts>/input.scope.json` (or
`input.scope.debug.json`) and confirm the subject you care about is actually in `targetFiles`. A
verdict read off a scope that excluded the subject is worse than no verdict, because it looks like
one.

## .when escalation IS correct — and how to make it legible

The levers can be genuinely exhausted. What makes the escalation legible is a fourth observation:

> **a `constraint` on a large branch ANTI-CONVERGES.** Every `.taken` you write to converge lands
> in `diffs: since-main`, so the subject grows with the very work meant to settle it.

Measured here: **117 files unchanged, 915.3k → 938.9k tokens in under two hours**; the four lanes
climbed 114% → 117% across six iterations. There is no number of further rounds that reaches a
verdict.

Tells that the levers are truly spent, rather than merely unpleasant:

- budget is **not** the gate if the lanes show `0/13` yet still **execute** each round (fresh
  overflow output, fresh log timestamps) — that means size, not rounds, is the limit
- `--as contemplated` replies *"this reviewer raised no blockers — no critique to answer"*
- the scoped re-runs already produced verdicts, and their findings are fixed and re-verified

**The exit verb is `--as overruled`, and `route.stone.set --help` marks it HUMAN ONLY** (as are
`approved` and `forced`). So mark `--as blocked` with the articulation, then ask. Do **not** reach
the same outcome by a self-widened review scope — that produces what the guard withholds.

## 🔴 name the terminal at the NARROWEST claim the measurement supports

The anti-convergence observation above is real and it is easy to over-read. This brief itself
over-read it, and the correction is the sharpest lesson on the page.

The tempting terminal is *"the branch outgrew review; no round can close this."* It is **larger than
the evidence**, and one measurement disproves it. Taken at the end of the same drive, on the largest
the branch had ever been:

| invocation | files | subject | context | verdict |
|---|---|---|---|---|
| the guard's own — `--diffs since-main`, no paths filter | 105 | 746.0k | **100.6–102.3%** | ✋ none |
| the SAME rubric + diff, `--paths-with 'src/**' --join intersect` | 73 | 402.6k | **40.8%** | renders |

Four lanes, all four at 40.8%. **The scoped lever fits with 59% of the window to spare.** So the
growth is true and it is **not what binds** — an exhaustion claimed on branch size would have been a
coast on a lever with more than half its headroom left.

The narrow claim the numbers actually support:

> The guard's invocation hardcodes `--diffs since-main` with no `--paths-with`, so it hands each
> ~700-token rubric a subject 2.5× larger than the one that rubric declares it grades — and
> `rhx route.mutate.guard` refuses even a read of the file where the flag would go. **The diagnosis
> and the repair are both reachable by the driver; the place to apply the repair is not.**

That version is one flag away from fixed, and a human can act on it in one move. The wide version
sounds more final and offers them no move at all.

> **Two escalations, same evidence, different worth: one says "this is impossible", the other says
> "this flag, in this file, which I cannot reach."** Prefer the second every time — and if you
> cannot state the terminal that narrowly, the diagnosis is not finished.

### and RUN the conditional a human hands you — never assume its antecedent

The framing that produced this correction was *"if a scoped re-run **also** overflows, that is an
earned exhaustion."* The honest response is to run the four scoped lanes, not to reason about
whether they would. They did not overflow, and two of them carried real findings — including a
whole runner journey with its most common path undriven, which would otherwise have shipped under a
board that reads eight green lanes and four `✋`.

**A lever is spent when it produces no findings, never when it produces the verdict you expected.**

## .the feed-forward this earned

> The overflow is structural at branch scale and will recur on any behavior branch of comparable
> size. A 117-file `since-main` subject against a ~700-token rubric cannot be closed by any
> improvement to the reviewer, the rubric, or the artifact. **The guard's own review invocation
> owes a `--paths-with` narrowed to each rubric's surface, or `--focus pull`.**
>
> Two enrolled reviewers reached that remedy independently and unprompted — one re-scoped itself to
> `**/*.snap`, the other abandoned the automated lane and read the diff by hand. When the reviewers
> route around the invocation, the invocation is the defect.

## .see also

- `rule.always.diagnose-reviewer-malfunctions` — an overflowed lane is a task, never a verdict
- `rule.always.converge-to-terminal` — earned exhaustion owes a cited record of every attempt
- `rule.always.converge-with-reviewers` — the `.given` / `.taken` contemplation loop
