import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn utility function", () => {
  it("should merge multiple class names", () => {
    const result = cn("text-red-500", "bg-blue-500");
    expect(result).toBe("text-red-500 bg-blue-500");
  });

  it("should handle conditional classes", () => {
    const result = cn("base-class", true && "conditional-class", false && "hidden-class");
    expect(result).toBe("base-class conditional-class");
  });

  it("should merge conflicting Tailwind classes", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });

  it("should handle arrays of classes", () => {
    const result = cn(["class-1", "class-2"], "class-3");
    expect(result).toBe("class-1 class-2 class-3");
  });

  it("should handle undefined and null values", () => {
    const result = cn("valid-class", undefined, null, "another-class");
    expect(result).toBe("valid-class another-class");
  });

  it("should deduplicate classes", () => {
    const result = cn("text-sm text-sm", "text-sm");
    expect(result).toBe("text-sm");
  });
});

