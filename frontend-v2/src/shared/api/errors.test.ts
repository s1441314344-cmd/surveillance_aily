import { describe, expect, it } from 'vitest';

import { getApiErrorMessage } from './errors';

describe('getApiErrorMessage', () => {
  it('returns joined detail when axios detail is an array', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: ['invalid schema', 'missing strategy'],
        },
      },
      message: 'request failed',
    };

    expect(getApiErrorMessage(error)).toBe('invalid schema; missing strategy');
  });

  it('returns detail string when axios detail is a string', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: 'camera not found',
        },
      },
      message: 'request failed',
    };

    expect(getApiErrorMessage(error)).toBe('camera not found');
  });

  it('falls back to generic error message when axios detail is missing', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {},
      },
      message: 'network timeout',
    };

    expect(getApiErrorMessage(error)).toBe('network timeout');
  });

  it('returns native error message for plain Error', () => {
    expect(getApiErrorMessage(new Error('unexpected failure'))).toBe('unexpected failure');
  });

  it('returns provided fallback when error cannot be parsed', () => {
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
