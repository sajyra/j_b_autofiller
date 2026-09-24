// Vitest test environment setup
import { vi } from 'vitest';

// Mock chrome APIs for testing environment
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockImplementation((keys) => {
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((items) => {
        return Promise.resolve();
      }),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue({}),
    },
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    openOptionsPage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
} as any;
