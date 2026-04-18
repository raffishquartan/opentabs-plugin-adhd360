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

const { submitObservations } = await import('./submit-observations.js');

interface ObsParams {
  systolic: number;
  diastolic: number;
  pulse: number;
  weightKg: number;
  heightCm: number;
}

const handle = (submitObservations as { handle: (params: ObsParams) => Promise<{ success: boolean; message: string }> }).handle;

const validParams: ObsParams = {
  systolic: 120,
  diastolic: 80,
  pulse: 72,
  weightKg: 85,
  heightCm: 180,
};

describe('submit_observations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(true);
    document.querySelector = vi.fn().mockReturnValue({});
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), hostname: 'app.adhd-360.com', pathname: '/' },
      writable: true,
    });
  });

  it('throws auth error when not authenticated', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    await expect(handle(validParams)).rejects.toThrow('Not logged in');
  });

  it('returns error when form not found', async () => {
    document.querySelector = vi.fn().mockReturnValue(null);
    const result = await handle(validParams);
    expect(result.success).toBe(false);
    expect(result.message).toContain('form not found');
  });

  it('returns error when user_id not found', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockReturnValue(null);
    const result = await handle(validParams);
    expect(result.success).toBe(false);
    expect(result.message).toContain('user_id');
  });

  it('submits form with correct metric values', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockReturnValue('42');
    mockSubmitRailsForm.mockResolvedValue({ ok: true, status: 200 });

    const result = await handle(validParams);
    expect(result.success).toBe(true);

    expect(mockSubmitRailsForm).toHaveBeenCalledWith('/patient_obs', expect.objectContaining({
      'assessment[systolic]': '120',
      'assessment[diastolic]': '80',
      'assessment[pulse]': '72',
      'assessment[obs_unit]': 'metric',
      'assessment[weight_kg]': '85',
      'assessment[height_cm]': '180',
      'assessment[user_id]': '42',
    }));
  });

  it('sends empty strings for imperial fields', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockReturnValue('42');
    mockSubmitRailsForm.mockResolvedValue({ ok: true, status: 200 });

    await handle(validParams);

    expect(mockSubmitRailsForm).toHaveBeenCalledWith('/patient_obs', expect.objectContaining({
      'assessment[weight_st]': '',
      'assessment[weight_lb]': '',
      'assessment[height_ft]': '',
      'assessment[height_in]': '',
    }));
  });

  it('returns error on failed submission', async () => {
    document.querySelector = vi.fn().mockReturnValue({});
    mockGetHiddenFieldValue.mockReturnValue('42');
    mockSubmitRailsForm.mockResolvedValue({ ok: false, status: 500 });

    const result = await handle(validParams);
    expect(result.success).toBe(false);
    expect(result.message).toContain('500');
  });
});
