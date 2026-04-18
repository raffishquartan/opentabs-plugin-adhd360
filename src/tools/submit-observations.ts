// Copyright (c) 2026 raffishquartan. All rights reserved.
// Licensed for personal use only.

import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { isAuthenticated, getHiddenFieldValue, submitRailsForm } from '../portal.js';

export const submitObservations = defineTool({
  name: 'submit_observations',
  displayName: 'Submit Observations',
  description:
    'Submit patient observations (blood pressure, pulse, weight, height) to the ADHD-360 portal. Required before prescriptions can be issued. All values use metric units (kg, cm).',
  icon: 'heart-pulse',
  group: 'Observations',

  input: z.object({
    systolic: z.number().int().min(60).max(250).describe('Systolic blood pressure in mmHg'),
    diastolic: z.number().int().min(30).max(150).describe('Diastolic blood pressure in mmHg'),
    pulse: z.number().int().min(30).max(200).describe('Pulse in beats per minute (BPM)'),
    weightKg: z.number().min(20).max(300).describe('Weight in kilograms'),
    heightCm: z.number().min(50).max(250).describe('Height in centimeters'),
  }),

  output: z.object({
    success: z.boolean(),
    message: z.string(),
  }),

  async handle(params) {
    if (!isAuthenticated()) {
      throw ToolError.auth('Not logged in. Please log in to app.adhd-360.com first.');
    }

    const formSelector = 'form[action="/patient_obs"]';
    const form = document.querySelector(formSelector);
    if (!form) {
      return { success: false, message: 'Observations form not found. Navigate to the dashboard first.' };
    }

    const userId = getHiddenFieldValue(formSelector, 'assessment[user_id]');
    if (!userId) {
      return { success: false, message: 'Could not extract user_id from the observations form.' };
    }

    const result = await submitRailsForm('/patient_obs', {
      'assessment[systolic]': String(params.systolic),
      'assessment[diastolic]': String(params.diastolic),
      'assessment[pulse]': String(params.pulse),
      'assessment[obs_unit]': 'metric',
      'assessment[weight_kg]': String(params.weightKg),
      'assessment[height_cm]': String(params.heightCm),
      'assessment[weight_st]': '',
      'assessment[weight_lb]': '',
      'assessment[height_ft]': '',
      'assessment[height_in]': '',
      'assessment[user_id]': userId,
      'commit': 'Save',
    });

    if (result.ok) {
      window.location.reload();
      return { success: true, message: 'Observations submitted successfully.' };
    }

    return { success: false, message: `Submission failed with status ${result.status}.` };
  },
});
