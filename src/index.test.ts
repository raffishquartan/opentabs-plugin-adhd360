import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  OpenTabsPlugin: class {},
  defineTool: (config: unknown) => config,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  ToolError: class extends Error {
    static auth(msg: string) {
      return new this(msg);
    }
    static notFound(msg: string) {
      return new this(msg);
    }
    static internal(msg: string) {
      return new this(msg);
    }
  },
}));

vi.mock('./portal.js', () => ({
  isAuthenticated: vi.fn(() => true),
  getCsrfToken: vi.fn(() => 'test-token'),
  getHiddenFieldValue: vi.fn(() => 'test-value'),
  submitRailsForm: vi.fn(() => ({ ok: true, status: 200 })),
}));

const plugin = (await import('./index.js')).default;

describe('Adhd360Plugin', () => {
  it('has correct name', () => {
    expect(plugin.name).toBe('adhd360');
  });

  it('has correct URL pattern', () => {
    expect(plugin.urlPatterns).toContain('*://app.adhd-360.com/*');
  });

  it('exposes exactly 3 tools', () => {
    expect(plugin.tools).toHaveLength(3);
  });

  it('all tool names are snake_case', () => {
    for (const tool of plugin.tools) {
      expect((tool as { name: string }).name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('tool names are get_status, request_prescription, submit_observations', () => {
    const names = plugin.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('get_status');
    expect(names).toContain('request_prescription');
    expect(names).toContain('submit_observations');
  });

  it('no tool names use banned write verbs', () => {
    const bannedPrefixes = ['create', 'update', 'delete', 'remove', 'edit', 'modify', 'move', 'rename', 'trash'];
    for (const tool of plugin.tools) {
      const name = (tool as { name: string }).name;
      for (const verb of bannedPrefixes) {
        expect(name.startsWith(verb)).toBe(false);
      }
    }
  });
});
