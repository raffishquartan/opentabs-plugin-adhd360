// Copyright (c) 2026 Chris Fogelberg. All rights reserved.
// Licensed for personal use only.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
