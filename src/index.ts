import { OpenTabsPlugin, log } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { getStatus } from './tools/get-status.js';
import { requestPrescription } from './tools/request-prescription.js';
import { submitObservations } from './tools/submit-observations.js';

class Adhd360Plugin extends OpenTabsPlugin {
  override readonly name = 'adhd360';
  override readonly displayName = 'ADHD 360';
  override readonly description = 'Check prescription status, request prescriptions, submit observations, and view pending actions';
  override readonly homepage = 'https://www.adhd-360.com';
  override readonly urlPatterns = ['*://app.adhd-360.com/*'];

  override readonly tools: ToolDefinition[] = [getStatus, requestPrescription, submitObservations];

  override async isReady(): Promise<boolean> {
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      return csrfToken != null;
    } catch {
      log.warn('ADHD-360 portal not available or user not authenticated');
      return false;
    }
  }
}

export default new Adhd360Plugin();
