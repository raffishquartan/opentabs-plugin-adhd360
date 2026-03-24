import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the SDK before importing portal
vi.mock('@opentabs-dev/plugin-sdk', () => ({
  ToolError: class extends Error {
    static auth(msg: string) {
      const e = new this(msg);
      (e as unknown as { code: string }).code = 'auth';
      return e;
    }
  },
}));

import { getCsrfToken, isAuthenticated, getHiddenFieldValue, submitRailsForm } from './portal.js';

describe('portal helpers', () => {
  let originalQuerySelector: typeof document.querySelector;

  beforeEach(() => {
    originalQuerySelector = document.querySelector;
  });

  afterEach(() => {
    document.querySelector = originalQuerySelector;
    vi.restoreAllMocks();
  });

  describe('getCsrfToken', () => {
    it('returns token from meta tag', () => {
      document.querySelector = vi.fn().mockReturnValue({ getAttribute: () => 'abc123' });
      expect(getCsrfToken()).toBe('abc123');
      expect(document.querySelector).toHaveBeenCalledWith('meta[name="csrf-token"]');
    });

    it('throws auth error when no meta tag', () => {
      document.querySelector = vi.fn().mockReturnValue(null);
      expect(() => getCsrfToken()).toThrow('Not authenticated');
    });

    it('throws auth error when meta tag has no content', () => {
      document.querySelector = vi.fn().mockReturnValue({ getAttribute: () => null });
      expect(() => getCsrfToken()).toThrow('Not authenticated');
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when csrf token exists', () => {
      document.querySelector = vi.fn().mockReturnValue({ getAttribute: () => 'token' });
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false when no meta tag', () => {
      document.querySelector = vi.fn().mockReturnValue(null);
      expect(isAuthenticated()).toBe(false);
    });

    it('returns false when meta tag has null content', () => {
      document.querySelector = vi.fn().mockReturnValue({ getAttribute: () => null });
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('getHiddenFieldValue', () => {
    it('returns value from hidden input', () => {
      // Use real DOM: create a form with hidden input
      const form = document.createElement('form');
      form.setAttribute('action', '/test');
      const input = document.createElement('input');
      input.setAttribute('name', 'user_id');
      input.value = 'user-42';
      form.appendChild(input);
      document.body.appendChild(form);

      expect(getHiddenFieldValue('form[action="/test"]', 'user_id')).toBe('user-42');

      document.body.removeChild(form);
    });

    it('returns null when form not found', () => {
      expect(getHiddenFieldValue('form[action="/missing"]', 'field')).toBeNull();
    });

    it('returns null when input not found in form', () => {
      const form = document.createElement('form');
      form.setAttribute('action', '/empty');
      document.body.appendChild(form);

      expect(getHiddenFieldValue('form[action="/empty"]', 'missing_field')).toBeNull();

      document.body.removeChild(form);
    });

    it('is safe against selector injection in field names', () => {
      // Field names with special CSS characters should not break or match incorrectly
      const form = document.createElement('form');
      form.setAttribute('action', '/inject-test');
      const input = document.createElement('input');
      input.setAttribute('name', 'field[with]brackets');
      input.value = 'found-it';
      form.appendChild(input);
      document.body.appendChild(form);

      // This should work via attribute comparison, not CSS selector interpolation
      expect(getHiddenFieldValue('form[action="/inject-test"]', 'field[with]brackets')).toBe('found-it');

      // A malicious field name should not match unrelated inputs
      expect(getHiddenFieldValue('form[action="/inject-test"]', '"] + input[name="')).toBeNull();

      document.body.removeChild(form);
    });
  });

  describe('submitRailsForm', () => {
    it('sends POST with CSRF token and form data', async () => {
      document.querySelector = vi.fn().mockReturnValue({ getAttribute: () => 'csrf-token-123' });

      const mockResponse = {
        ok: true,
        status: 200,
        redirected: false,
        url: 'https://app.adhd-360.com/',
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await submitRailsForm('/test', { key1: 'val1', key2: 'val2' });

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall?.[0]).toBe('/test');

      const options = fetchCall?.[1] as RequestInit;
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('same-origin');
      expect((options.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-token-123');

      const body = options.body as string;
      expect(body).toContain('authenticity_token=csrf-token-123');
      expect(body).toContain('key1=val1');
      expect(body).toContain('key2=val2');
      expect(body).toContain('utf8=%E2%9C%93');
    });

    it('returns redirect URL when response is redirected', async () => {
      document.querySelector = vi.fn().mockReturnValue({ getAttribute: () => 'token' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        redirected: true,
        url: 'https://app.adhd-360.com/success',
      });

      const result = await submitRailsForm('/test', {});
      expect(result.redirectUrl).toBe('https://app.adhd-360.com/success');
    });

    it('throws auth error when not authenticated', async () => {
      document.querySelector = vi.fn().mockReturnValue(null);
      await expect(submitRailsForm('/test', {})).rejects.toThrow('Not authenticated');
    });
  });
});
