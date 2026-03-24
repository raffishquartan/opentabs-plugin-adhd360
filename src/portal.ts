import { ToolError } from '@opentabs-dev/plugin-sdk';

/**
 * Extract CSRF token from the Rails meta tag.
 */
export function getCsrfToken(): string {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!token) {
    throw ToolError.auth('Not authenticated. Please log in to app.adhd-360.com first.');
  }
  return token;
}

/**
 * Check if the user is authenticated by looking for CSRF token.
 */
export function isAuthenticated(): boolean {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') != null;
}

/**
 * Extract a hidden input value from a form.
 */
export function getHiddenFieldValue(formSelector: string, fieldName: string): string | null {
  const form = document.querySelector(formSelector);
  if (!form) return null;
  const input = form.querySelector(`input[name="${fieldName}"]`) as HTMLInputElement | null;
  return input?.value ?? null;
}

/**
 * Submit a Rails form via fetch, including CSRF token.
 */
export async function submitRailsForm(
  action: string,
  formData: Record<string, string>,
): Promise<{ ok: boolean; status: number; redirectUrl?: string }> {
  const csrfToken = getCsrfToken();

  const body = new URLSearchParams();
  body.append('utf8', '\u2713');
  body.append('authenticity_token', csrfToken);
  for (const [key, value] of Object.entries(formData)) {
    body.append(key, value);
  }

  const response = await fetch(action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRF-Token': csrfToken,
    },
    body: body.toString(),
    credentials: 'same-origin',
    redirect: 'follow',
  });

  return {
    ok: response.ok,
    status: response.status,
    redirectUrl: response.redirected ? response.url : undefined,
  };
}
