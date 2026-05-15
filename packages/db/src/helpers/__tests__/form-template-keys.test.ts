import { describe, test, expect } from "bun:test";
import {
  slugifyFormTemplateKeySource,
  allocateUniqueKeyFromBase,
  InvalidFormTemplateKeyError,
  normalizeClientFormTemplateKeyOrThrow,
  FORM_TEMPLATE_KEY_REGEX,
} from "../form-template-keys";

describe("form-template-keys (SUP-28)", () => {
  test("slugify produces ^[a-z][a-z0-9_]{0,63}$", () => {
    expect(slugifyFormTemplateKeySource("Hello World")).toBe("hello_world");
    expect(FORM_TEMPLATE_KEY_REGEX.test("hello_world")).toBe(true);
    expect(slugifyFormTemplateKeySource("123x")).toBe("s_123x");
    expect(
      FORM_TEMPLATE_KEY_REGEX.test(slugifyFormTemplateKeySource("123x"))
    ).toBe(true);
  });

  test("allocateUniqueKeyFromBase appends _2, _3", () => {
    const taken = new Set(["foo", "foo_2"]);
    expect(allocateUniqueKeyFromBase("foo", (k) => taken.has(k))).toBe("foo_3");
  });

  test("normalizeClientFormTemplateKeyOrThrow rejects invalid keys", () => {
    expect(() => normalizeClientFormTemplateKeyOrThrow("9bad")).toThrow(
      InvalidFormTemplateKeyError
    );
  });
});
