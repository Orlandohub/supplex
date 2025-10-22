import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("test", 300));
    expect(result.current).toBe("test");
  });

  it("debounces value changes", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    expect(result.current).toBe("initial");

    // Change the value
    rerender({ value: "updated", delay: 300 });

    // Value should not update immediately
    expect(result.current).toBe("initial");

    // Fast-forward time by 300ms
    vi.advanceTimersByTime(300);

    // Wait for the update
    await waitFor(() => {
      expect(result.current).toBe("updated");
    });
  });

  it("cancels previous timeout on rapid changes", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    // First change
    rerender({ value: "first", delay: 300 });
    vi.advanceTimersByTime(100);

    // Second change before timeout
    rerender({ value: "second", delay: 300 });
    vi.advanceTimersByTime(100);

    // Third change before timeout
    rerender({ value: "third", delay: 300 });
    vi.advanceTimersByTime(300);

    // Should only have the last value
    await waitFor(() => {
      expect(result.current).toBe("third");
    });
  });

  it("uses custom delay", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    rerender({ value: "updated", delay: 500 });

    // Should not update after 300ms
    vi.advanceTimersByTime(300);
    expect(result.current).toBe("initial");

    // Should update after 500ms total
    vi.advanceTimersByTime(200);
    await waitFor(() => {
      expect(result.current).toBe("updated");
    });
  });

  it("works with different value types", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 123, delay: 300 },
      }
    );

    expect(result.current).toBe(123);

    rerender({ value: 456, delay: 300 });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current).toBe(456);
    });
  });

  it("handles empty strings", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "test", delay: 300 },
      }
    );

    rerender({ value: "", delay: 300 });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current).toBe("");
    });
  });
});

