import { given, then, when } from '../../../contract';
import {
  evaluateThreshold,
  getDefaultThreshold,
  parseThresholdToMs,
} from './evaluateThreshold';

describe('parseThresholdToMs', () => {
  given('[case1] numeric threshold', () => {
    when('[t0] parse is called', () => {
      then('returns the number as-is', () => {
        expect(parseThresholdToMs({ threshold: 3000 })).toEqual(3000);
        expect(parseThresholdToMs({ threshold: 500 })).toEqual(500);
      });
    });
  });

  given('[case2] simple string formats', () => {
    when('[t0] milliseconds format', () => {
      then('parses correctly', () => {
        expect(parseThresholdToMs({ threshold: '500ms' })).toEqual(500);
        expect(parseThresholdToMs({ threshold: '100ms' })).toEqual(100);
      });
    });

    when('[t1] seconds format', () => {
      then('converts to milliseconds', () => {
        expect(parseThresholdToMs({ threshold: '3s' })).toEqual(3000);
        expect(parseThresholdToMs({ threshold: '1.5s' })).toEqual(1500);
      });
    });

    when('[t2] minutes format', () => {
      then('converts to milliseconds', () => {
        expect(parseThresholdToMs({ threshold: '2m' })).toEqual(120000);
        expect(parseThresholdToMs({ threshold: '0.5m' })).toEqual(30000);
      });
    });

    when('[t3] hours format', () => {
      then('converts to milliseconds', () => {
        expect(parseThresholdToMs({ threshold: '1h' })).toEqual(3600000);
      });
    });

    when('[t4] uppercase formats', () => {
      then('handles case-insensitively', () => {
        expect(parseThresholdToMs({ threshold: '3S' })).toEqual(3000);
        expect(parseThresholdToMs({ threshold: '500MS' })).toEqual(500);
      });
    });
  });

  given('[case3] iso 8601 formats', () => {
    when('[t0] PT prefix format', () => {
      then('parses via iso-time', () => {
        expect(parseThresholdToMs({ threshold: 'PT3S' })).toEqual(3000);
        expect(parseThresholdToMs({ threshold: 'PT1M' })).toEqual(60000);
      });
    });
  });
});

describe('evaluateThreshold', () => {
  given('[case1] duration above threshold', () => {
    when('[t0] evaluate is called', () => {
      then('returns true', () => {
        expect(evaluateThreshold({ duration: 5000, threshold: 3000 })).toEqual(
          true,
        );
        expect(evaluateThreshold({ duration: 5000, threshold: '3s' })).toEqual(
          true,
        );
      });
    });
  });

  given('[case2] duration below threshold', () => {
    when('[t0] evaluate is called', () => {
      then('returns false', () => {
        expect(evaluateThreshold({ duration: 2000, threshold: 3000 })).toEqual(
          false,
        );
        expect(evaluateThreshold({ duration: 2000, threshold: '3s' })).toEqual(
          false,
        );
      });
    });
  });

  given('[case3] duration equal to threshold', () => {
    when('[t0] evaluate is called', () => {
      then('returns false (not strictly greater)', () => {
        expect(evaluateThreshold({ duration: 3000, threshold: 3000 })).toEqual(
          false,
        );
      });
    });
  });
});

describe('getDefaultThreshold', () => {
  given('[case1] unit scope', () => {
    when('[t0] get default is called', () => {
      then('returns 3000ms', () => {
        expect(getDefaultThreshold({ scope: 'unit' })).toEqual(3000);
      });
    });
  });

  given('[case2] integration scope', () => {
    when('[t0] get default is called', () => {
      then('returns 10000ms', () => {
        expect(getDefaultThreshold({ scope: 'integration' })).toEqual(10000);
      });
    });
  });

  given('[case3] acceptance scope', () => {
    when('[t0] get default is called', () => {
      then('returns 10000ms', () => {
        expect(getDefaultThreshold({ scope: 'acceptance' })).toEqual(10000);
      });
    });
  });

  given('[case4] no scope specified', () => {
    when('[t0] get default is called', () => {
      then('returns unit default (3000ms)', () => {
        expect(getDefaultThreshold({})).toEqual(3000);
      });
    });
  });
});
