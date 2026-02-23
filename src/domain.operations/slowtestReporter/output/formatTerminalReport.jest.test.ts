import { given, then, when } from '@src/contract';
import type { SlowtestReport } from '@src/domain.objects/SlowtestReport';

import { formatDuration, formatTerminalReport } from './formatTerminalReport';

describe('formatDuration', () => {
  given('[case1] duration in milliseconds', () => {
    when('[t0] format is called', () => {
      then('returns human-readable string for seconds', () => {
        const result = formatDuration({ ms: 8710 });
        expect(result).toMatch(/8.*s/i); // should contain "8" and "s"
      });

      then('returns human-readable string for minutes', () => {
        const result = formatDuration({ ms: 125000 });
        expect(result).toMatch(/2.*m/i); // should contain "2" and "m"
      });

      then('returns human-readable string for hours', () => {
        const result = formatDuration({ ms: 7200000 });
        expect(result).toMatch(/2.*h/i); // should contain "2" and "h"
      });

      then('returns 0s for zero duration', () => {
        const result = formatDuration({ ms: 0 });
        expect(result).toMatch(/0.*s/i);
      });
    });
  });
});

describe('formatTerminalReport', () => {
  given('[case1] report with multiple slow files', () => {
    const report: SlowtestReport = {
      generated: '2026-01-31T14:23:00Z',
      summary: {
        total: 15010,
        files: 4,
        slow: 3,
      },
      files: [
        { path: 'src/fast.test.ts', duration: 1300, slow: false },
        { path: 'src/invoice.test.ts', duration: 8710, slow: true },
        { path: 'src/auth.test.ts', duration: 3500, slow: true },
        { path: 'src/customer.test.ts', duration: 1500, slow: true },
      ],
    };

    when('[t0] format is called with default config', () => {
      then('returns report header', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('slowtest report:');
      });

      then('only shows slow files, sorted by duration', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('invoice.test.ts');
        expect(result).toContain('auth.test.ts');
        expect(result).toContain('customer.test.ts');
        expect(result).not.toContain('fast.test.ts'); // not slow
        // verify sorted by duration (slowest first)
        const invoiceIndex = result.indexOf('invoice.test.ts');
        const authIndex = result.indexOf('auth.test.ts');
        const customerIndex = result.indexOf('customer.test.ts');
        expect(invoiceIndex).toBeLessThan(authIndex);
        expect(authIndex).toBeLessThan(customerIndex);
      });

      then('marks slow files', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('[SLOW]');
      });

      then('shows summary with total and file count', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('total:');
        expect(result).toContain('files: 4');
        expect(result).toContain('slow: 3 file(s) above threshold');
      });

      then('matches snapshot', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] format is called with top=2', () => {
      then('limits output to top 2 slow files', () => {
        const result = formatTerminalReport({ report, config: { top: 2 } });
        expect(result).toContain('invoice.test.ts');
        expect(result).toContain('auth.test.ts');
        expect(result).not.toContain('customer.test.ts'); // truncated
        expect(result).not.toContain('fast.test.ts'); // not slow
      });

      then('shows truncation notice', () => {
        const result = formatTerminalReport({ report, config: { top: 2 } });
        expect(result).toContain('shows 2 of 3 slow files');
      });

      then('matches snapshot', () => {
        const result = formatTerminalReport({ report, config: { top: 2 } });
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] report with hierarchy', () => {
    const report: SlowtestReport = {
      generated: '2026-01-31T14:23:00Z',
      summary: { total: 8710, files: 1, slow: 1 },
      files: [
        {
          path: 'src/invoice.test.ts',
          duration: 8710,
          slow: true,
          blocks: [
            {
              type: 'given',
              name: '[case1] overdue invoice',
              duration: 7230,
              hookDuration: 340,
              blocks: [
                {
                  type: 'when',
                  name: '[t0] nurture triggered',
                  duration: 6890,
                  hookDuration: 0,
                  tests: [
                    { name: 'then: sends reminder email', duration: 6010 },
                    { name: 'then: logs notification', duration: 880 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    when('[t0] format is called', () => {
      then('renders nested hierarchy with indentation', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('given: [case1] overdue invoice');
        expect(result).toContain('when: [t0] nurture triggered');
        expect(result).toContain('then: sends reminder email');
      });

      then('shows hook duration for blocks with hooks', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('(hooks:');
      });

      then('shows test durations', () => {
        const result = formatTerminalReport({ report, config: {} });
        // check that test names and durations appear
        expect(result).toContain('sends reminder email');
        expect(result).toContain('logs notification');
      });

      then('matches snapshot', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case3] empty report', () => {
    const report: SlowtestReport = {
      generated: '2026-01-31T14:23:00Z',
      summary: { total: 0, files: 0, slow: 0 },
      files: [],
    };

    when('[t0] format is called', () => {
      then('returns report with zero summary', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toContain('slowtest report:');
        expect(result).toContain('files: 0');
      });

      then('matches snapshot', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case4] report with no slow files', () => {
    const report: SlowtestReport = {
      generated: '2026-01-31T14:23:00Z',
      summary: { total: 3400, files: 2, slow: 0 },
      files: [
        { path: 'src/fast1.test.ts', duration: 1700, slow: false },
        { path: 'src/fast2.test.ts', duration: 1700, slow: false },
      ],
    };

    when('[t0] format is called', () => {
      then('does not show slow count in summary', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).not.toContain('slow:');
        expect(result).not.toContain('[SLOW]');
      });

      then('matches snapshot', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case5] multiple files with hierarchy', () => {
    const report: SlowtestReport = {
      generated: '2026-01-31T14:23:00Z',
      summary: { total: 15000, files: 3, slow: 2 },
      files: [
        {
          path: 'src/invoice.test.ts',
          duration: 8710,
          slow: true,
          blocks: [
            {
              type: 'given',
              name: '[case1] overdue invoice',
              duration: 7230,
              hookDuration: 500,
              blocks: [
                {
                  type: 'when',
                  name: '[t0] nurture triggered',
                  duration: 6730,
                  hookDuration: 0,
                  tests: [
                    { name: 'then: sends reminder email', duration: 6010 },
                    { name: 'then: logs notification', duration: 720 },
                  ],
                },
              ],
            },
          ],
        },
        {
          path: 'src/auth.test.ts',
          duration: 4200,
          slow: true,
          blocks: [
            {
              type: 'given',
              name: '[case1] user with mfa',
              duration: 3800,
              hookDuration: 200,
              blocks: [
                {
                  type: 'when',
                  name: '[t0] login attempt',
                  duration: 3600,
                  hookDuration: 0,
                  tests: [
                    { name: 'then: prompts for totp', duration: 1800 },
                    { name: 'then: validates token', duration: 1800 },
                  ],
                },
              ],
            },
            {
              type: 'given',
              name: '[case2] user without mfa',
              duration: 400,
              hookDuration: 0,
              tests: [{ name: 'then: logs in directly', duration: 400 }],
            },
          ],
        },
        {
          path: 'src/fast.test.ts',
          duration: 2090,
          slow: false,
          blocks: [
            {
              type: 'given',
              name: '[case1] simple scenario',
              duration: 2090,
              hookDuration: 0,
              tests: [
                { name: 'then: works', duration: 1000 },
                { name: 'then: also works', duration: 1090 },
              ],
            },
          ],
        },
      ],
    };

    when('[t0] format is called', () => {
      then('matches snapshot', () => {
        const result = formatTerminalReport({ report, config: {} });
        expect(result).toMatchSnapshot();
      });
    });
  });
});
