import { type IsoDurationWords, toMilliseconds } from 'iso-time';

/**
 * .what = parse duration string to milliseconds
 * .why = converts user-friendly formats to ms for threshold comparison
 *
 * supported formats:
 * - number: pass through
 * - "3s", "500ms", "2m", "1h": simple human formats
 * - "PT3S", "PT500M": iso 8601 formats (via iso-time)
 */
export const parseThresholdToMs = (input: {
  threshold: number | string;
}): number => {
  // number passes through
  if (typeof input.threshold === 'number') return input.threshold;

  const str = input.threshold.trim().toLowerCase();

  // check for simple human formats: 3s, 500ms, 2m, 1h
  const simpleMatch = str.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/);
  if (simpleMatch) {
    const value = parseFloat(simpleMatch[1]!);
    const unit = simpleMatch[2]!;

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
    }
  }

  // check for iso 8601 format (PT prefix)
  if (str.startsWith('pt')) {
    return toMilliseconds(input.threshold.toUpperCase() as IsoDurationWords);
  }

  // fallback: try iso-time directly (handles object-like strings)
  try {
    return toMilliseconds(input.threshold.toUpperCase() as IsoDurationWords);
  } catch {
    throw new Error(
      `evaluateThreshold: unable to parse threshold "${input.threshold}"`,
    );
  }
};

/**
 * .what = classify file as slow based on duration vs threshold
 * .why = binary classification for slow test visibility
 */
export const evaluateThreshold = (input: {
  duration: number;
  threshold: number | string;
}): boolean => {
  const thresholdMs = parseThresholdToMs({ threshold: input.threshold });
  return input.duration > thresholdMs;
};

/**
 * .what = get default slow threshold based on test scope
 * .why = sensible defaults for zero-config experience
 */
export const getDefaultThreshold = (input: {
  scope?: 'unit' | 'integration' | 'acceptance';
}): number => {
  switch (input.scope) {
    case 'unit':
      return 3000; // 3s
    case 'integration':
    case 'acceptance':
      return 10000; // 10s
    default:
      return 3000; // default to unit threshold
  }
};
