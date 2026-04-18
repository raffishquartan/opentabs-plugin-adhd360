// Copyright (c) 2026 Chris Fogelberg. All rights reserved.
// Licensed for personal use only.

import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { isAuthenticated, getHiddenFieldValue } from '../portal.js';

/**
 * Fetch the prescriptions page and parse the most recent prescription.
 */
async function fetchLatestPrescription(): Promise<{
  date: string | null;
  clinician: string | null;
  medication: string | null;
}> {
  try {
    const response = await fetch('/visitors/prescriptions', {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) return { date: null, clinician: null, medication: null };

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find the first data row in the prescriptions table
    const rows = doc.querySelectorAll('table tr, tbody tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        const date = cells[0]?.textContent?.trim() ?? null;
        const clinician = cells[1]?.textContent?.trim() ?? null;
        // cells[2] is script number, cells[3] is medication
        const medication = cells[3]?.textContent?.trim() ?? null;
        if (date && date.match(/\d{2}\/\d{2}\/\d{4}/)) {
          return { date, clinician, medication };
        }
      }
    }

    // Fallback: parse from page text using regex
    const text = doc.body.textContent ?? '';
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    return { date: dateMatch?.[1] ?? null, clinician: null, medication: null };
  } catch {
    return { date: null, clinician: null, medication: null };
  }
}

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
      lastDate: z.string().nullable().describe('Date of the last prescription (DD/MM/YYYY)'),
      lastClinician: z.string().nullable().describe('Clinician who issued the last prescription'),
      lastMedication: z.string().nullable().describe('Medication and quantity of the last prescription'),
    }),
    todoItems: z.array(z.string()).describe('List of to-do items that must be completed'),
    observationsRequired: z.boolean().describe('Whether observations (BP, pulse, weight, height) are required'),
    observationsMessage: z.string().nullable().describe('Message about observations if present'),
  }),

  async handle() {
    if (!isAuthenticated()) {
      throw ToolError.auth('Not logged in. Please log in to app.adhd-360.com first.');
    }

    if (window.location.hostname !== 'app.adhd-360.com') {
      throw ToolError.internal('Not on the ADHD-360 portal. Navigate to app.adhd-360.com first.');
    }

    // Ensure we're on the dashboard for reading to-do items and forms
    // If not on dashboard, fetch it
    let pageText: string;
    let pageDoc: Document;

    if (window.location.pathname === '/' || window.location.pathname === '') {
      pageText = document.body.textContent ?? '';
      pageDoc = document;
    } else {
      // Fetch dashboard HTML without navigating
      const dashResponse = await fetch('/', { credentials: 'same-origin', headers: { Accept: 'text/html' } });
      const dashHtml = await dashResponse.text();
      const parser = new DOMParser();
      pageDoc = parser.parseFromString(dashHtml, 'text/html');
      pageText = pageDoc.body.textContent ?? '';
    }

    // Check prescription request button
    const prescriptionBtn = Array.from(pageDoc.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Request new prescription'),
    );

    const canRequest = prescriptionBtn != null;
    const buttonText = prescriptionBtn?.textContent?.trim() ?? null;

    // Fetch latest prescription details from prescriptions page
    const latest = await fetchLatestPrescription();

    // Read to-do list by scanning for known items in the page text
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

    return {
      authenticated: true,
      prescription: {
        canRequest,
        buttonText,
        lastDate: latest.date,
        lastClinician: latest.clinician,
        lastMedication: latest.medication,
      },
      todoItems,
      observationsRequired,
      observationsMessage,
    };
  },
});
