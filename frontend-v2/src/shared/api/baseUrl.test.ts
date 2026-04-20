import { describe, expect, it } from 'vitest';
import { resolveBaseUrl } from '@/shared/api/baseUrl';

describe('resolveBaseUrl', () => {
  it('returns the configured env base url when present', () => {
    expect(resolveBaseUrl({
      envValue: 'https://api.example.com',
      fallbackBaseUrl: 'http://localhost:8000',
      envName: 'VITE_API_BASE_URL',
      isProduction: false,
    })).toBe('https://api.example.com');
  });

  it('falls back to localhost in non-production when env is missing', () => {
    expect(resolveBaseUrl({
      envValue: undefined,
      fallbackBaseUrl: 'http://localhost:8000',
      envName: 'VITE_API_BASE_URL',
      isProduction: false,
    })).toBe('http://localhost:8000');
  });

  it('throws in production when env is missing', () => {
    expect(() => resolveBaseUrl({
      envValue: undefined,
      fallbackBaseUrl: 'http://localhost:8000',
      envName: 'VITE_API_BASE_URL',
      isProduction: true,
    })).toThrow('VITE_API_BASE_URL');
  });

  it('treats blank env values as missing in production', () => {
    expect(() => resolveBaseUrl({
      envValue: '   ',
      fallbackBaseUrl: 'http://localhost:8091',
      envName: 'VITE_LOCAL_DETECTOR_BASE_URL',
      isProduction: true,
    })).toThrow('VITE_LOCAL_DETECTOR_BASE_URL');
  });
});
