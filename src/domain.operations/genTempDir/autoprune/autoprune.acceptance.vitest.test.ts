// import from the contract layer only (blackbox)
//
// .why THIS FILE EXISTS = 🔴 `vitest.acceptance.config.ts` declares the vitest
//      acceptance seam, and with **zero files** to match it every vitest
//      invocation passes `--passWithNoTests` — so the whole runner journey reports
//      green at exit 0 with one grey line, and no acceptance run occurs at all.
//
//      that is a **journey with a config and no traveller**, and it reads to a
//      reviewer as *"pre-branch, out of bound"* debt to defer — a verdict that
//      does not survive one fact: **the vitest adapter IS this behavior's
//      deliverable**, and this diff modifies that very config. an empty acceptance
//      config for a surface you ship is not inherited debt; it is a gap in what
//      you built.
//
// .why it mirrors the jest suite's `[case0]` rather than invents its own shape =
//      the two runners' journeys differ in exactly ONE structural way (one key vs
//      two), and whoever knows the jest arm should read this one with no second
//      model to hold
import { genTempDir, getOneTempDirRoot, isTempDir } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';

describe('autoprune, from inside a real VITEST acceptance run', () => {
  describe('[case1] the vitest journey this config declares and never drove', () => {
    describe('[t0] a maintainer opens the config this suite runs under', () => {
      it('🔴 it wires the ONE key vitest has, at the contract subpath', () => {
        // .why = vitest reads setup AND teardown from one module, so the
        //        half-wired state jest's two-key surface can reach is unreachable
        //        here. that asymmetry is a claim this behavior makes in prose —
        //        and prose is where it stays unless a vitest RUN reads the config
        const config = fs.readFileSync(
          path.join(__dirname, '../../../../vitest.acceptance.config.ts'),
          'utf-8',
        );

        // 🔴 the wire-up lines, ON THE RECORD — the jest arm snaps its config
        // block whole (`genTempDir.acceptance [case0] [t0b]`), and fragments alone
        // let a doubled line, a lost quote, or a SECOND key added to the vitest
        // config pass every `toContain` and still break every consumer's wire-up.
        // a fragment proves a word is present; only a record proves what sits
        // around it
        //
        // .why the LINES rather than the file = a config this diff edits would
        //      redden on every legitimate edit and teach a human to
        //      `--updateSnapshot` past it. the hook keys are the contract; the
        //      rest of the file is not
        // .note = it matches the HOOK KEYS, never a bare `global` — this config
        //         also carries `globals: true`, an unrelated vitest option, and a
        //         loose match would fold it into the record and make the count
        //         below read 2 for a perfectly-wired config
        const linesWired = config
          .split('\n')
          .filter((line) => /global(Setup|Teardown)/.test(line))
          .map((line) => line.trim());
        expect(linesWired).toMatchSnapshot();

        // PAIRED, always — a snapshot alone is rewritten green by the very run
        // that should have failed it
        expect(config).toContain(
          "globalSetup: ['./src/contract/autoprune.setup.vitest.ts']",
        );

        // and there is NO second key to miss — the jest arm asserts two, this
        // asserts one AND that no teardown key exists to be forgotten
        expect(config).not.toContain('globalTeardown');
        expect(linesWired.length).toEqual(1);
      });
    });

    describe('[t1] the run this very test is inside was minted by vitest', () => {
      it('🔴 a run id reached this worker, so the vitest setup hook RAN', () => {
        // .why = the config is a declaration; this is the observation. it is
        //        also the first time the vitest mint chain is exercised BY
        //        VITEST rather than by a jest-driven child process — a jest test
        //        that spawns vitest proves the module works; only this proves
        //        the vitest RUNNER carries the id into its own workers
        const run = process.env.TEST_FNS_RUN;
        expect(run).toBeDefined();
        expect(run).toMatch(/^r[a-f0-9]{8}$/i);
      });
    });

    describe('[t2] a dir made from inside this run', () => {
      it('🔴 it carries THIS run stamp, so the teardown filter will match it', () => {
        // 🔴 the assertion that matters most, and the one a wired-but-inert
        // hook still fails: a reclaim can be perfectly declared and match zero.
        // if the id in the name and the id in the env ever diverge, every dir
        // this runner makes survives every run — silently, under a green board
        const run = process.env.TEST_FNS_RUN;
        const dir = genTempDir({ slug: 'vitest-acceptance' });

        expect(isTempDir({ path: dir })).toEqual(true);
        expect(path.basename(dir)).toContain(`.${run}.`);

        // and it sits under the root the contract exports, so a consumer's own
        // clamp counts the same population this run's teardown will reclaim
        //
        // 🔴 `genTempDir` hands back the SYMLINK view, and `pathPhysical` is the
        //    other one — the export yields both precisely because they differ.
        //    to compare the returned dir against `pathPhysical` here reads
        //    right and goes RED, which is the two-view contract at work on its
        //    own author. both are asserted, so a change that collapses them
        //    into one is caught here rather than downstream
        const { pathPhysical, pathSymlink } = getOneTempDirRoot();
        expect(path.dirname(dir)).toEqual(pathSymlink);
        expect(pathPhysical).not.toEqual(pathSymlink);

        // the symlink lands on the physical root, so the two views name one
        // population — the property a consumer's clamp depends on
        expect(fs.realpathSync(pathSymlink)).toEqual(
          fs.realpathSync(pathPhysical),
        );
      });
    });

    describe('[t3] the name THIS runner writes, volatile bytes masked', () => {
      it('🔴 it renders the shape the jest arm renders, under vitest own loader', () => {
        // .why THIS EXISTS = every `[t]` above is FUNCTIONAL, so the whole vitest
        //      acceptance grain held zero snapshots and a human who reads a PR
        //      could see no rendered artifact from the runner that is half this
        //      behavior's deliverable.
        //
        // .why a MASK rather than a skip = the rubric's own guidance: a journey
        //      whose output holds non-deterministic bytes is NOT exempt — mask
        //      the volatile field and snap the live journey. the timestamp, the
        //      run id and the hex suffix vary per run; the SHAPE around them is
        //      the contract, and it is exactly what a drift would move.
        //
        // .why NOT a snapshot of the config = a config this diff edits reddens on
        //      every legitimate edit, which teaches a human to `--updateSnapshot`
        //      past it. this snaps an OUTPUT, which is what the rule asks for
        const run = process.env.TEST_FNS_RUN as string;
        const dir = genTempDir({ slug: 'vitest-shape' });
        const { pathPhysical, pathSymlink } = getOneTempDirRoot();

        const rendered = {
          name: path
            .basename(dir)
            .replace(/^\d{4}-\d{2}-\d{2}T[\d-]{8}\.\d{3}Z/, '<ts>')
            .replace(run, '<run>')
            .replace(/\.[a-f0-9]{8}$/, '.<hex>'),
          isTempDir: isTempDir({ path: dir }),
          sitsUnderSymlinkRoot: path.dirname(dir) === pathSymlink,
          rootViewsDiffer: pathPhysical !== pathSymlink,
          rootViewsNameOnePlace:
            fs.realpathSync(pathSymlink) === fs.realpathSync(pathPhysical),
        };

        expect(rendered).toMatchSnapshot();

        // 🔴 PAIRED, always. a snapshot alone is rewritten green by the very run
        // that should have failed it, on any machine with `--updateSnapshot`.
        // these five state the contract in a form no resnap can launder
        expect(rendered.name).toEqual('<ts>.<run>.vitest-shape.<hex>');
        expect(rendered.isTempDir).toEqual(true);
        expect(rendered.sitsUnderSymlinkRoot).toEqual(true);
        expect(rendered.rootViewsDiffer).toEqual(true);
        expect(rendered.rootViewsNameOnePlace).toEqual(true);
      });
    });
  });
});
