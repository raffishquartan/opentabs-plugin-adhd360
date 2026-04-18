// Copyright (c) 2026 raffishquartan. All rights reserved.
// Licensed for personal use only.

import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { isAuthenticated, getHiddenFieldValue, submitRailsForm } from '../portal.js';

export const requestPrescription = defineTool({
  name: 'request_prescription',
  displayName: 'Request Prescription',
  description:
    'Submit a new prescription request on the ADHD-360 portal. The user must be logged in and a prescription must be available to request. Always confirm with the user before calling this tool.',
  icon: 'pill',
  group: 'Prescriptions',

  input: z.object({
    confirm: z
      .boolean()
      .describe('Must be true to confirm the request. Safety check to prevent accidental submissions.'),
  }),

  output: z.object({
    success: z.boolean(),
    message: z.string(),
  }),

  async handle(params) {
    if (!params.confirm) {
      return { success: false, message: 'Request not confirmed. Set confirm=true to submit.' };
    }

    if (!isAuthenticated()) {
      throw ToolError.auth('Not logged in. Please log in to app.adhd-360.com first.');
    }

    const formSelector = 'form[action="/prescription_requests"]';
    const form = document.querySelector(formSelector);
    if (!form) {
      return {
        success: false,
        message: 'Prescription request form not found on this page. Navigate to the dashboard first.',
      };
    }

    const userId = getHiddenFieldValue(formSelector, 'prescription_request[user_id]');
    const clinicianId = getHiddenFieldValue(formSelector, 'prescription_request[clinician_id]');
    const lastPrescription = getHiddenFieldValue(formSelector, 'prescription_request[last_prescription]');

    if (!userId || !clinicianId) {
      return {
        success: false,
        message: 'Could not extract required form fields (user_id, clinician_id). The form may have changed.',
      };
    }

    const result = await submitRailsForm('/prescription_requests', {
      'prescription_request[last_prescription]': lastPrescription ?? '',
      'prescription_request[clinician_id]': clinicianId,
      'prescription_request[user_id]': userId,
      'prescription_request[prescription_free]': 'false',
      'prescription_request[prescription_reason_free]': '',
    });

    if (result.ok) {
      window.location.reload();
      return { success: true, message: 'Prescription requested successfully.' };
    }

    return { success: false, message: `Request failed with status ${result.status}.` };
  },
});
