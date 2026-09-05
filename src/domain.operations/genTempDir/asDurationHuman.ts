import { asDurationInWords } from 'iso-time';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;

/**
 * .what = a millisecond count, as a duration a human reads at a glance — `24h`
 * .why = the hold message closed with "reclaimed by the age gate after
 *        86400000ms", which charges the reader a division by 3,600,000 to learn it
 *        means a day. the raw ms stays — it is the literal unit of the
 *        `TEST_FNS_MAX_AGE_MS` key the very next clause tells them to set — and the
 *        human form rides beside it, so neither reader pays for the other
 *
 * .note = the window is CONFIGURABLE, so this is derived from the live value and
 *         never a hardcoded "24h". a consumer who narrows it to 90 minutes is told
 *         `5400000ms (1h 30m)`, not a stale default
 *
 * .note = every unit is handed over, zeros included, because `asDurationInWords`
 *         already skips them, caps the render at two, and falls back to `0s` when
 *         all are zero. a hand-rolled omission here would duplicate three rules the
 *         glossary owns — and the `IsoDurationShape` type refuses a shape whose
 *         units are all optional, which is that duplicate caught at compile time
 *
 * .note = it caps at HOURS, so a 48h window reads `48h` rather than `2d`. days are
 *         a unit a reader must re-multiply to compare against the `..._MS` key
 *         beside it, and no window this gate takes makes the hour count unreadable
 *
 * .note = 🔴 `slowtestReporter/output/formatTerminalReport.ts` holds a near-twin
 *         (`formatDuration` + its own `msToShape`). the two are DUPLICATE at two
 *         call-site domains, which `rule.prefer.wet-over-dry` tolerates and
 *         `rule.prefer.most-common-denominator` would lift to
 *         `src/domain.operations/` on a third. the lift is deferred rather than
 *         forgotten: it would drag an unrelated module into this branch's diff on
 *         its final verification round, and the duplicate is four lines of unit
 *         arithmetic over one shared `iso-time` renderer
 */
export const asDurationHuman = (input: { ms: number }): string =>
  asDurationInWords({
    hours: Math.floor(input.ms / MS_PER_HOUR),
    minutes: Math.floor((input.ms % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((input.ms % MS_PER_MINUTE) / MS_PER_SECOND),
    milliseconds: input.ms % MS_PER_SECOND,
  });
