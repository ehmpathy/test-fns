import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { given, then, when } from '@src/domain.operations/givenWhenThen';
import { useThen } from '@src/domain.operations/useThen';

const FIXTURES_DIR = path.join(__dirname, '.test/assets');
const DIST_REPORTER = path.join(
  process.cwd(),
  'dist/domain.operations/slowtestReporter/reporter/SlowtestReporterJest.js',
);

/**
 * .what = failfast if built reporter does not exist
 * .why = acceptance tests require `npm run build` to have been run first
 */
if (!fs.existsSync(DIST_REPORTER)) {
  throw new Error(
    `reporter not built at ${DIST_REPORTER}. run \`npm run build\` first.`,
  );
}

/**
 * .what = helper to run jest with slowtest reporter on a fixture
 * .why = reduces duplication across test cases
 */
const runJestWithReporter = (input: {
  testMatch: string;
  outputPath: string;
  slow?: number;
}): { stdout: string; exitCode: number } => {
  const jestConfig = `
    module.exports = {
      testEnvironment: 'node',
      testMatch: ['${input.testMatch}'],
      transform: { '^.+\\\\.tsx?$': '@swc/jest' },
      reporters: [
        'default',
        [
          '${DIST_REPORTER.replace(/\\/g, '\\\\')}',
          { ${input.slow ? `slow: ${input.slow},` : ''} output: '${input.outputPath.replace(/\\/g, '\\\\')}' }
        ]
      ],
    };
  `;

  const configPath = path.join(__dirname, '.test/.output/jest.temp.config.js');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, jestConfig);

  try {
    const stdout = execSync(
      `npx jest --config "${configPath}" --rootDir "${FIXTURES_DIR}" --passWithNoTests`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, FORCE_COLOR: '0' },
      },
    );
    return { stdout, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      exitCode: execError.status ?? 1,
    };
  } finally {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  }
};

describe('slowtestReporter acceptance', () => {
  given('[case1] jest test suite with slow-suite fixture', () => {
    const outputPath = path.join(
      __dirname,
      '.test/.output/slow-suite-report.json',
    );

    beforeAll(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
    afterAll(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });

    when('[t0] jest runs with slowtest reporter', () => {
      const result = useThen('reporter executes successfully', () =>
        runJestWithReporter({
          testMatch: '**/slow-suite/*.jest.test.ts',
          outputPath,
          slow: 100,
        }),
      );

      then('terminal output contains slowtest report header', () => {
        expect(result.stdout).toContain('slowtest report');
      });

      then('terminal output shows file path', () => {
        expect(result.stdout).toContain('slow.jest.test.ts');
      });

      then('json file is written to output path', () => {
        expect(fs.existsSync(outputPath)).toBe(true);
      });

      then('json file contains valid report structure', () => {
        const content = fs.readFileSync(outputPath, 'utf-8');
        const report = JSON.parse(content);

        expect(report).toHaveProperty('generated');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('files');
        expect(report.summary).toHaveProperty('total');
        expect(report.summary).toHaveProperty('files');
        expect(report.summary).toHaveProperty('slow');
      });

      then('json file contains file with blocks hierarchy', () => {
        const content = fs.readFileSync(outputPath, 'utf-8');
        const report = JSON.parse(content);

        // find the slow-suite file
        const slowFile = report.files.find((f: { path: string }) =>
          f.path.includes('slow.jest.test.ts'),
        );
        expect(slowFile).toBeDefined();
        expect(slowFile.duration).toBeGreaterThan(0);

        // verify blocks hierarchy exists
        expect(slowFile.blocks).toBeDefined();
        expect(slowFile.blocks.length).toBeGreaterThan(0);

        // verify given block structure
        const givenBlock = slowFile.blocks[0];
        expect(givenBlock.type).toBe('given');
        expect(givenBlock.name).toContain('[case1]');
      });
    });
  });

  given('[case2] jest test suite with hierarchy-suite fixture', () => {
    const outputPath = path.join(
      __dirname,
      '.test/.output/hierarchy-suite-report.json',
    );

    beforeAll(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
    afterAll(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });

    when('[t0] jest runs with slowtest reporter on nested hierarchy', () => {
      const result = useThen('reporter captures nested structure', () =>
        runJestWithReporter({
          testMatch: '**/hierarchy-suite/*.jest.test.ts',
          outputPath,
        }),
      );

      then('json file is written', () => {
        expect(fs.existsSync(outputPath)).toBe(true);
      });

      then('json captures nested given inside given', () => {
        const content = fs.readFileSync(outputPath, 'utf-8');
        const report = JSON.parse(content);

        const hierarchyFile = report.files.find((f: { path: string }) =>
          f.path.includes('nested.jest.test.ts'),
        );
        expect(hierarchyFile).toBeDefined();
        expect(hierarchyFile.blocks).toBeDefined();

        // find outer given
        const outerGiven = hierarchyFile.blocks.find((b: { name: string }) =>
          b.name.includes('[case1] outer given'),
        );
        expect(outerGiven).toBeDefined();

        // verify nested given exists within outer given
        const nestedGiven = outerGiven.blocks?.find((b: { name: string }) =>
          b.name.includes('[case1.1] nested given'),
        );
        expect(nestedGiven).toBeDefined();
        expect(nestedGiven.type).toBe('given');
      });
    });
  });

  given('[case3] jest test suite with plain-describe-suite fixture', () => {
    const outputPath = path.join(
      __dirname,
      '.test/.output/plain-describe-report.json',
    );

    beforeAll(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
    afterAll(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });

    when('[t0] jest runs with slowtest reporter on plain describe', () => {
      const result = useThen('reporter handles plain describe gracefully', () =>
        runJestWithReporter({
          testMatch: '**/plain-describe-suite/*.jest.test.ts',
          outputPath,
        }),
      );

      then('json file is written', () => {
        expect(fs.existsSync(outputPath)).toBe(true);
      });

      then('file-level duration is captured', () => {
        const content = fs.readFileSync(outputPath, 'utf-8');
        const report = JSON.parse(content);

        const plainFile = report.files.find((f: { path: string }) =>
          f.path.includes('plain.jest.test.ts'),
        );
        expect(plainFile).toBeDefined();
        expect(plainFile.duration).toBeGreaterThanOrEqual(0);
      });

      then('blocks are marked as describe type', () => {
        const content = fs.readFileSync(outputPath, 'utf-8');
        const report = JSON.parse(content);

        const plainFile = report.files.find((f: { path: string }) =>
          f.path.includes('plain.jest.test.ts'),
        );

        // plain describe blocks should be captured
        if (plainFile.blocks && plainFile.blocks.length > 0) {
          const describeBlock = plainFile.blocks[0];
          expect(describeBlock.type).toBe('describe');
        }
      });
    });
  });
});
