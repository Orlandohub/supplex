import "@testing-library/jest-dom/vitest";

// Mock ResizeObserver for tests (required for Radix UI components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
