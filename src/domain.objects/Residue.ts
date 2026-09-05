/**
 * .what = an entry a reclaim could not remove, and the reason it resisted
 * .why = every reclaim in this behavior reports the same shape to the same human —
 *        the run-scoped one, both age-gate passes, and the marker a teardown leaves
 *        for the next run to read. one shape, one declaration
 *
 * .note = it lived as THREE separate inline declarations (PruneStaleAudit,
 *         PruneRunAudit, RunMarker) until a consistency pass found them. three
 *         copies of one type are three chances to add a field to two of them
 *
 * .note = it lives HERE rather than beside its reader, because `domain.objects/`
 *         is where this repo puts a type-led module — `SlowtestBlock`,
 *         `SlowtestConfig`, `SlowtestReport`, all PascalCase, all pure declarations.
 *         `domain.operations/` names its files after the OPERATION they hold (7 of 7
 *         in genTempDir/), so a type-named file there had no precedent at all
 */
export interface Residue {
  /** the absolute path that resisted */
  path: string;

  /** why it resisted — an errno like EACCES, EBUSY, ENOTEMPTY */
  errno: string;
}
