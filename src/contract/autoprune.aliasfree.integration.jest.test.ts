import { genTempDir, given, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * .what = proves no module on jest's globalSetup/globalTeardown path imports via `@src`
 * .why = 🔴 jest's `moduleNameMapper` is a TEST-RUNTIME mapper: it maps only the imports
 *        jest's own runtime pulls in. a `globalSetup` module — and every module it pulls
 *        in, TRANSITIVELY — is loaded by node's plain `require` BEFORE that runtime
 *        exists. so one `@src` anywhere in that graph kills every jest run at startup
 *        with `Cannot find module`, before a single test executes
 *
 * .note = 🔴 this clamp exists because a COMMENT cannot hold it. every file on this
 *         path carries a `.note` that reads "RELATIVE, never the @src alias", and one
 *         mechanical find-and-replace rewrites all of them anyway — a rewrite reads
 *         code and never the prose that guards it. a rule that lives only in a comment
 *         is a rule the next tool breaks, and the comment then sits above the broken
 *         line and states the opposite of what the code does
 *
 * .note = the unit suite does fail loudly on a violation, so why clamp at all? because
 *         the ACCEPTANCE suite does NOT: `tsc-alias` rewrites `@src` at build, so the
 *         built artifact every acceptance test drives is immune. the defect is visible
 *         from exactly one of our three suites — and there it reads as a module-not-found
 *         stack out of jest's internals, which names neither the cause nor the fix
 *
 * .note = the vitest twin is deliberately NOT in scope here. vite aliases at the LOADER,
 *         so `autoprune.setup.vitest.ts` may use `@src` and does — see `[case2]`, which
 *         pins that asymmetry so a later "consistency" pass cannot quietly erase it
 */

/** src/, derived from this file rather than from cwd, so the walk survives any invocation dir */
const DIR_SRC: string = path.join(__dirname, '..');

/**
 * the two modules jest loads by hand, outside its own runtime
 *
 * .why = these are the ROOTS of the constraint. every module reachable from them
 *        inherits it, which is why this walk is transitive rather than a two-file check
 */
const FILES_ROOT_JEST: string[] = [
  path.join(DIR_SRC, 'contract/autoprune.setup.jest.ts'),
  path.join(DIR_SRC, 'contract/autoprune.teardown.jest.ts'),
];

/**
 * every syntax that can name a module, and so every syntax this walk must read
 *
 * .why = 🔴 a clamp that can be evaded is a clamp that does not hold. a reader that
 *        matches ONE form — `from '...'`, single-quoted — lets four ordinary syntaxes
 *        sail past it green while they break every jest run at startup:
 *
 *          import { x } from "@src/foo"     ← double quotes
 *          require('@src/foo')              ← cjs, which the compiled hooks use
 *          import '@src/foo'                ← side-effect, no `from` at all
 *          await import('@src/foo')         ← dynamic, a CALL rather than a keyword
 *
 *        that is this file's own stated failure mode turned on itself: its header
 *        warns that *a rule that lives only in a comment is a rule the next tool
 *        will break* — and a rule that lives in a regex over one third of the
 *        language breaks the same way.
 *
 * .note = the DYNAMIC form is the one that hides best, and the gap it opens is the
 *         lesson rather than the fix: `import(...)` has the shape of a CALL, so it
 *         matches neither the `from` tail nor the `import <quote>` head, and it
 *         reads to a skimmer as already-covered by the word `import` above it.
 *         a claim of exhaustiveness in prose does not make a list exhaustive
 *
 * .note = `export { x } from '@src/foo'` needs no pattern of its own — the first
 *         one anchors on the `from` TAIL, so a re-export is read for free. that is
 *         the reason to anchor on the tail rather than on the statement head
 *
 * .note = each pattern captures the specifier in group 1, so the reader below is
 *         one loop rather than one branch per form
 */
const PATTERNS_SPECIFIER: RegExp[] = [
  // `from '...'` / `from "..."` — the tail of an import or a re-export, which
  // matches across newlines for free since it anchors on the tail, never the head
  /\bfrom\s+['"]([^'"]+)['"]/g,
  // `require('...')` / `require("...")` — node cjs, and the form a compiled or
  // hand-written interop module reaches for
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // `import '...'` — a side-effect import, which names a module and has no `from`
  /\bimport\s+['"]([^'"]+)['"]/g,
  // `import('...')` — the dynamic form. it is a CALL, so the head pattern above
  // cannot reach it: that one demands whitespace then a quote, and this has a paren
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * .what = reads every module specifier a file imports, re-exports, or requires
 * .why = a multi-line `import { a, b } from 'x'` must count the same as a one-line
 *        one, so these match on the specifier's own shape rather than on a
 *        whole-statement shape
 */
const getAllSpecifiers = (input: { file: string }): string[] => {
  const content = fs.readFileSync(input.file, 'utf8');
  return PATTERNS_SPECIFIER.flatMap((pattern) =>
    [...content.matchAll(pattern)].map((match) => match[1] ?? ''),
  );
};

/**
 * .what = turns a relative specifier into the file it names, or null
 * .why = only a relative specifier continues the walk. a bare package name leaves our
 *        source tree, and an `@src` specifier is the very defect we collect
 *
 * .note = `path.join` rather than `path.resolve`, and they agree here: the base is
 *         absolute, and join normalizes the `../` segments the same way
 */
const getOneModuleFile = (input: {
  from: string;
  specifier: string;
}): string | null => {
  if (!input.specifier.startsWith('.')) return null;
  const base = path.join(path.dirname(input.from), input.specifier);
  const candidates = [`${base}.ts`, path.join(base, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

/**
 * .what = walks the transitive import graph from a set of roots
 * .why = the constraint is transitive, so a check of the two entry files alone would
 *        pass while `setupAutoprune.ts` two hops in carried the alias that breaks the run
 *
 * @returns every file reached, and every `@src` import found among them
 */
const walkOneModuleGraph = (input: {
  roots: string[];
}): {
  filesReached: string[];
  importsAliased: Array<{ file: string; specifier: string }>;
} => {
  const filesReached: string[] = [];
  const importsAliased: Array<{ file: string; specifier: string }> = [];
  const queue = [...input.roots];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file) break;
    if (filesReached.includes(file)) continue;
    filesReached.push(file);

    for (const specifier of getAllSpecifiers({ file })) {
      if (specifier.startsWith('@src/'))
        importsAliased.push({ file, specifier });
      const next = getOneModuleFile({ from: file, specifier });
      if (next) queue.push(next);
    }
  }

  return { filesReached, importsAliased };
};

describe('autoprune.aliasfree', () => {
  given(
    '[case1] the module graph rooted at jest globalSetup + globalTeardown',
    () => {
      when('[t0] every import specifier in it is read', () => {
        then('🔴 no module in the graph imports through the @src alias', () => {
          const audit = walkOneModuleGraph({ roots: FILES_ROOT_JEST });

          // report the offenders by path, so a failure names the file rather than a count
          expect(
            audit.importsAliased.map(
              (entry) =>
                `${path.relative(DIR_SRC, entry.file)} -> ${entry.specifier}`,
            ),
          ).toEqual([]);
        });

        then(
          '🔴 the walk REACHED the subsystem, rather than pass vacuously',
          () => {
            // .why = guard the guard. a walk that stopped at its two roots would report zero
            //        offenders and go green forever — the same failhide shape this behavior
            //        exists to end. so pin that it genuinely traversed into the operations
            const audit = walkOneModuleGraph({ roots: FILES_ROOT_JEST });
            const reached = audit.filesReached.map((file) =>
              path.relative(DIR_SRC, file),
            );

            expect(reached).toContain(
              'domain.operations/genTempDir/autoprune/setupAutoprune.ts',
            );
            expect(reached).toContain(
              'domain.operations/genTempDir/autoprune/teardownAutoprune.ts',
            );
            expect(reached).toContain(
              'domain.operations/genTempDir/runMarker.ts',
            );
            expect(reached).toContain(
              'domain.operations/genTempDir/pruneStale.ts',
            );
            expect(reached).toContain(
              'infra/isomorph.test/detectTestRunner.ts',
            );
          },
        );

        then(
          'the walk crossed at least three folders, so it is not folder-local',
          () => {
            const audit = walkOneModuleGraph({ roots: FILES_ROOT_JEST });
            const folders = new Set(
              audit.filesReached.map(
                (file) => path.relative(DIR_SRC, file).split(path.sep)[0] ?? '',
              ),
            );

            // contract/ + domain.operations/ + domain.objects/ + infra/
            expect(folders.size).toBeGreaterThanOrEqual(3);
          },
        );
      });
    },
  );

  given(
    '[case2] the vitest globalSetup, whose loader DOES carry the alias',
    () => {
      when('[t0] its import specifiers are read', () => {
        then(
          'it uses @src, and that is correct rather than an oversight',
          () => {
            // .why = vite aliases at the LOADER, so a vitest globalSetup gets the alias the
            //        same as any test file. this assertion is the record of that asymmetry:
            //        a later pass that "aligns" the two runners would turn this red and be
            //        told why, rather than silently adopt a workaround the other runner needs
            const specifiers = getAllSpecifiers({
              file: path.join(DIR_SRC, 'contract/autoprune.setup.vitest.ts'),
            });

            expect(
              specifiers.filter((specifier) => specifier.startsWith('@src/'))
                .length,
            ).toBeGreaterThan(0);
          },
        );
      });
    },
  );

  given('[case3] a module that names its imports every legal way', () => {
    when('[t0] the specifier reader walks it', () => {
      // 🔴 guard the guard, at the level BELOW the walk. `[case1]`'s second `then`
      // proves the walk reaches the subsystem; it says no word about whether the
      // READER sees every syntax once it gets there. a reader that matches exactly
      // one form leaves a double-quoted or `require`d `@src` invisible to a clamp
      // whose whole purpose is to be unevadable
      //
      // .why a synthetic fixture = every form must be exercised whether or not the
      //      real source tree happens to contain them today. a clamp that is only
      //      as strong as the current codebase's style weakens the moment someone
      //      writes a `require`
      //
      // .note = 🔴 this case can only prove what it LISTS, so it is the twin of the
      //         pattern list rather than an independent check on it. a form absent
      //         from `PATTERNS_SPECIFIER` is a form absent here too, and both read
      //         green — which is how a form like the DYNAMIC import slips a whole
      //         review round. so when a form is added above, it is added here in
      //         the same edit, and the fixture is written to READ as a census of
      //         the language rather than as a sample of this repo's habits
      then('🔴 it reads EVERY form, not only single-quoted `from`', () => {
        const tmpDir = genTempDir({ slug: 'aliasfree-syntax' });
        const file = path.join(tmpDir, 'every-form.ts');
        fs.writeFileSync(
          file,
          [
            "import { a } from './single-quoted';",
            'import { b } from "./double-quoted";',
            "const c = require('./required-single');",
            'const d = require("./required-double");',
            "import './side-effect';",
            // the RE-EXPORT tail — it needs no pattern of its own, and this line is
            // what proves that, rather than a comment that merely claims it
            "export { f } from './re-exported';",
            // the DYNAMIC form — a call, so neither the `from` tail nor the
            // `import <quote>` head reaches it. that is what makes it the form
            // most apt to sit absent from the pattern list and from here alike
            "const g = await import('./dynamic-single');",
            'const h = await import("./dynamic-double");',
            // the multi-line form, kept so a later rewrite of the patterns cannot
            // regress the property the tail anchor gives for free
            'import {',
            '  e,',
            "} from './multi-line';",
          ].join('\n'),
          'utf8',
        );

        expect(getAllSpecifiers({ file }).sort()).toEqual(
          [
            './double-quoted',
            './dynamic-double',
            './dynamic-single',
            './multi-line',
            './re-exported',
            './required-double',
            './required-single',
            './side-effect',
            './single-quoted',
          ].sort(),
        );
      });
    });
  });
});
