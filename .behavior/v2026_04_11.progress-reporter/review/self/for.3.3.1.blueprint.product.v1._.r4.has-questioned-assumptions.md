# self-review r4: has-questioned-assumptions

surface all technical assumptions and question each one.

---

## assumptions questioned

### assumption 1: heartbeat interval 1000ms

**what we assume:** 1 second is the right interval for heartbeats.

**what if the opposite were true?**
- too frequent: adds unnecessary i/o overhead
- too slow: not real-time

**evidence:** vision says "~1s" — explicitly stated requirement.

**verdict:** ✅ holds. vision is explicit.

---

### assumption 2: estimatedTime is test count

**what we assume:** blueprint line 75 says "set outof from options.estimatedTime"

**what if the opposite were true?**

**investigation:**
checked `@jest/reporters` types:
```ts
export declare type ReporterOnStartOptions = {
  estimatedTime: number;
};
```

`estimatedTime` is the estimated TIME in seconds for the run, NOT the test count!

**evidence:** jest uses this for progress bar time, not test count.

**verdict:** ❌ BUG. blueprint incorrectly assumes estimatedTime is test count.

**fix:** change blueprint to initialize `outof = 0` in onRunStart, update from `aggregatedResult.numTotalTests` in onTestFileResult.

---

### assumption 3: fs.appendFile is safe for parallel workers

**what we assume:** parallel workers won't corrupt output files.

**what if the opposite were true?** file corruption, interleaved json lines.

**evidence:** jest reporters run in the main process. each `onTestFileResult` callback is serialized. only one writer, no race condition.

**verdict:** ✅ holds. main process is single-threaded for callbacks.

---

### assumption 4: testResult.console contains all output

**what we assume:** console property has structured log entries.

**what if the opposite were true?** might be undefined or different structure.

**evidence:** jest TestResult type includes `console?: ConsoleBuffer` where ConsoleBuffer is an array of `{message, origin, type}` entries.

**verdict:** ✅ holds. but must handle undefined case (no console output).

---

### assumption 5: directory creation in constructor

**what we assume:** create directory in constructor.

**what if the opposite were true?** could defer to onRunStart.

**analysis:**
- constructor: directory created even if tests skip
- onRunStart: directory created only if tests run

**verdict:** ⚠️ could optimize. but follows extant pattern. acceptable.

---

### assumption 6: truncation removes end, not start

**what we assume:** truncate to first 10kb of output.

**what if the opposite were true?** could truncate start and retain end where errors usually appear.

**analysis:** failures appear at end. retain end is more useful for diagnosis.

**verdict:** ⚠️ potential improvement. but vision says "truncate to 10kb" without direction. will retain first 10kb for simplicity; can enhance later if wisher requests.

---

## fix applied: estimatedTime bug

**issue:** blueprint line 75 says "set outof from options.estimatedTime (if available) or 0"

**problem:** `estimatedTime` is estimated TIME in seconds, not test count.

**fix applied:** updated blueprint to:
- initialize `outof = 0` in onRunStart
- rely on onTestFileResult to update `outof` from `aggregatedResult.numTotalTests`

---

## summary

| assumption | verdict | action |
|------------|---------|--------|
| heartbeat 1000ms | ✅ holds | none |
| estimatedTime is count | ❌ bug | fixed in blueprint |
| fs.appendFile safety | ✅ holds | none |
| testResult.console | ✅ holds | handle undefined |
| directory in constructor | ⚠️ acceptable | none (follows extant) |
| truncation direction | ⚠️ acceptable | none (default to start) |

---

## non-issues

### three transformer files

**questioned:** too many files?

**why it holds:** each transformer has distinct responsibility. iso-time dependency isolated. enables separate unit tests.

### contract re-exports

**questioned:** why not export directly from implementation?

**why it holds:** contract file is package entry point. follows extant slowtest.reporter.jest.ts pattern. enables future implementation changes without contract break.

