import { describe, expect, it } from 'vitest';

import { mapDetectionError } from './map-error';

describe('mapDetectionError', () => {
  it('DET-018 maps a RangeError to out-of-memory', () => {
    expect(mapDetectionError(new RangeError('Array buffer allocation failed')).error).toBe('out-of-memory');
  });

  it('DET-018 maps an allocation message to out-of-memory', () => {
    expect(mapDetectionError(new Error('Cannot enlarge memory arrays')).error).toBe('out-of-memory');
  });

  it('DET-018 maps anything else to unknown with its message', () => {
    expect(mapDetectionError(new Error('bad'))).toEqual({ error: 'unknown', detail: 'bad' });
    expect(mapDetectionError(1234)).toEqual({ error: 'unknown', detail: '1234' });
  });
});
