// Copyright (c) 2026 Chris Fogelberg. All rights reserved.
// Licensed for personal use only.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsAuthenticated = vi.fn();
const mockGetHiddenFieldValue = vi.fn();
const mockSubmitRailsForm = vi.fn();

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  ToolError: class extends Error {
    static auth(msg: string) {
      return new this(msg);
    }
    static internal(msg: string) {
      return new this(msg);
    }
  },
}));

vi.mock('../portal.js', () => ({
  isAuthenticated: (...args: unknown[]) => mockIsAuthenticated(...args),
  getHiddenFieldValue: (...args: unknown[]) => mockGetHiddenFieldValue(...args),
  submitRailsForm: (...args: unknown[]) => mockSubmitRailsForm(...args),
}));

const { requestPrescription } = await import('./request-prescription.js');
const handle = (requestPrescription as { handle: (params: { confirm: boolean }) => Promise<{ success: boolean; message: string }> }).handle;

describe('request_prescription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(true);
    // Mock document.querySelector for form detection
    document.querySelector = vi.fn().mockReturnValue({});
  });

  it('rejects when confirm is false', async () => {
    const result = await handle({ confirm: false });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not confirmed');
  });

  it('throws auth error when not authenticated', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    await expect(handle({ confirm: true })).rejects.toThrow('Not logged in');
  });

  it('returns error when form not found', async () => {
    document.querySelector = vi.fn().mockReturnValue(null);
    const result = await handle({ confirm: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('form not found');
  });

  it('returns error when user_id missing', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockReturnValue(null);

    const result = await handle({ confirm: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not extract');
  });

  it('submits form with correct fields when confirmed', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockImplementation((_form: string, field: string) => {
      if (field === 'prescription_request[user_id]') return '123';
      if (field === 'prescription_request[clinician_id]') return '456';
      if (field === 'prescription_request[last_prescription]') return '789';
      return null;
    });
    mockSubmitRailsForm.mockResolvedValue({ ok: true, status: 200 });

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock, hostname: 'app.adhd-360.com', pathname: '/' },
      writable: true,
    });

    const result = await handle({ confirm: true });
    expect(result.success).toBe(true);
    expect(mockSubmitRailsForm).toHaveBeenCalledWith('/prescription_requests', expect.objectContaining({
      'prescription_request[user_id]': '123',
      'prescription_request[clinician_id]': '456',
      'prescription_request[prescription_free]': 'false',
    }));
  });

  it('returns error on failed submission', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockImplementation((_form: string, field: string) => {
      if (field === 'prescription_request[user_id]') return '123';
      if (field === 'prescription_request[clinician_id]') return '456';
      return null;
    });
    mockSubmitRailsForm.mockResolvedValue({ ok: false, status: 422 });

    const result = await handle({ confirm: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('422');
  });
});
