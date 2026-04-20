import { describe, expect, it } from 'vitest';
import axios, { AxiosError } from 'axios';
import { getApiErrorMessage } from './apiErrorMessage';

describe('getApiErrorMessage', () => {
  it('reads array detail from axios response', () => {
    const error = new AxiosError('bad request');
    Object.assign(error, {
      response: {
        data: {
          detail: ['invalid schema', 'missing strategy'],
        },
      },
    });
    Object.defineProperty(axios, 'isAxiosError', {
      value: () => true,
      configurable: true,
    });

    expect(getApiErrorMessage(error)).toBe('invalid schema; missing strategy');
  });

  it('reads string detail from axios response', () => {
    const error = new AxiosError('bad request');
    Object.assign(error, {
      response: {
        data: {
          detail: 'camera not found',
        },
      },
    });
    Object.defineProperty(axios, 'isAxiosError', {
      value: () => true,
      configurable: true,
    });

    expect(getApiErrorMessage(error)).toBe('camera not found');
  });

  it('falls back to axios error message when detail is missing', () => {
    const error = new AxiosError('network timeout');
    Object.defineProperty(axios, 'isAxiosError', {
      value: () => true,
      configurable: true,
    });

    expect(getApiErrorMessage(error)).toBe('network timeout');
  });

  it('falls back to standard error message and then custom fallback', () => {
    expect(getApiErrorMessage(new Error('unexpected failure'))).toBe('unexpected failure');
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
