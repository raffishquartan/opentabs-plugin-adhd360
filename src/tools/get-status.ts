import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { isAuthenticated, getHiddenFieldValue } from '../portal.js';

export const getStatus = defineTool({
  name: 'get_status',
  displayName: 'Get Portal Status',
  description:
    'Read the ADHD-360 patient portal dashboard: prescription availability, to-do list items, pending observations, and alerts. Must be logged in at app.adhd-360.com.',
  icon: 'clipboard-list',
  group: 'Status',

  input: z.object({}),

  output: z.object({
    authenticated: z.boolean().describe('Whether the user is logged in'),
    prescription: z.object({
      canRequest: z.boolean().describe('Whether a new prescription can be requested now'),
      buttonText: z.string().nullable().describe('Text on the prescription request button, if present'),
      lastPrescription: z.string().nullable().describe('Last prescription date if available'),
    }),
    todoItems: z.array(z.string()).describe('List of to-do items that must be completed'),
    observationsRequired: z.boolean().describe('Whether observations (BP, pulse, weight, height) are required'),
    observationsMessage: z.string().nullable().describe('Message about observations if present'),
    userName: z.string().nullable().describe('Logged-in user name'),
  }),

  async handle() {
    if (!isAuthenticated()) {
      throw ToolError.auth('Not logged in. Please log in to app.adhd-360.com first.');
    }

    if (window.location.hostname !== 'app.adhd-360.com') {
      throw ToolError.internal('Not on the ADHD-360 portal. Navigate to app.adhd-360.com first.');
    }

    // Check prescription request button
    const prescriptionBtn = Array.from(document.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Request new prescription'),
    );

    const canRequest = prescriptionBtn != null;
    const buttonText = prescriptionBtn?.textContent?.trim() ?? null;

    // Get last prescription info from hidden field
    const lastPrescription = getHiddenFieldValue(
      'form[action="/prescription_requests"]',
      'prescription_request[last_prescription]',
    );

    // Read to-do list by scanning for known items in the page text
    const pageText = document.body.textContent ?? '';
    const knownTodoItems = [
      'GP Details Requested',
      'Confirm Home Address',
      'Required Obs. And measurements',
      'Document Uploads',
      'Prescription Exemption Status',
    ];
    const todoItems = knownTodoItems.filter(item => pageText.includes(item));

    // Check if observations are required
    const observationsRequired =
      pageText.includes('Your Obs and measurements are required') || pageText.includes('Required Obs');

    let observationsMessage: string | null = null;
    if (observationsRequired) {
      const obsMatch = pageText.match(/(Your Obs and measurements are required[^.]*\.)/);
      observationsMessage = obsMatch?.[1]?.trim() ?? 'Observations are required by your clinician.';
    }

    // Get user name from the top of the page
    const userNameMatch = pageText.match(/^(\w+)\s*Account Details/);
    const userName = userNameMatch?.[1] ?? null;

    return {
      authenticated: true,
      prescription: {
        canRequest,
        buttonText,
        lastPrescription,
      },
      todoItems,
      observationsRequired,
      observationsMessage,
      userName,
    };
  },
});
