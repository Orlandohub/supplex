import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

// `useDebounce` schedules a `setTimeout`. With `vi.useFakeTimers()` we
// must drive the clock manually, then flush React state updates that the
// fired timer queued. Wrapping the timer advance in `act` performs that
// flush synchronously, removing the need for `waitFor` (which would
// otherwise poll with the same fake clock and never resolve, causing the
// 5-second test timeout we used to see in CI).
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("test", 300));
    expect(result.current).toBe("test");
  });

  it("debounces value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    expect(result.current).toBe("initial");

    rerender({ value: "updated", delay: 300 });
    // The debounced value must not update synchronously.
    expect(result.current).toBe("initial");

    advance(300);

    expect(result.current).toBe("updated");
  });

  it("cancels previous timeout on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    rerender({ value: "first", delay: 300 });
    advance(100);

    rerender({ value: "second", delay: 300 });
    advance(100);

    rerender({ value: "third", delay: 300 });
    advance(300);

    expect(result.current).toBe("third");
  });

  it("uses custom delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    rerender({ value: "updated", delay: 500 });

    advance(300);
    expect(result.current).toBe("initial");

    advance(200);
    expect(result.current).toBe("updated");
  });

  it("works with different value types", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 123, delay: 300 },
      }
    );

    expect(result.current).toBe(123);

    rerender({ value: 456, delay: 300 });
    advance(300);

    expect(result.current).toBe(456);
  });

  it("handles empty strings", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "test", delay: 300 },
      }
    );

    rerender({ value: "", delay: 300 });
    advance(300);

    expect(result.current).toBe("");
  });
});
