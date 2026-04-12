import { describe, test, expect } from "bun:test";
import { validateFileMagicBytes } from "../file-validation";

/**
 * Unit Tests: Magic-Byte File Validation
 * Story 2.2.20 — Upload Hardening (C7)
 */

function makeFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

// Real magic bytes for common formats
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK.. (also used by docx/xlsx)
const EXE_MAGIC = new Uint8Array([0x4d, 0x5a]); // MZ header

function padBytes(magic: Uint8Array, totalSize: number): Uint8Array {
  const buf = new Uint8Array(totalSize);
  buf.set(magic);
  return buf;
}

describe("validateFileMagicBytes", () => {
  test("accepts valid PDF file", async () => {
    const file = makeFile(padBytes(PDF_MAGIC, 1024), "report.pdf", "application/pdf");
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("application/pdf");
  });

  test("accepts valid PNG file", async () => {
    const file = makeFile(padBytes(PNG_MAGIC, 1024), "logo.png", "image/png");
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("image/png");
  });

  test("accepts valid JPEG file", async () => {
    const file = makeFile(padBytes(JPEG_MAGIC, 1024), "photo.jpg", "image/jpeg");
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("image/jpeg");
  });

  test("accepts ZIP-based Office file (xlsx declared)", async () => {
    const file = makeFile(
      padBytes(ZIP_MAGIC, 1024),
      "data.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(true);
  });

  test("accepts ZIP-based Office file (docx declared)", async () => {
    const file = makeFile(
      padBytes(ZIP_MAGIC, 1024),
      "doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(true);
  });

  test("rejects EXE disguised as PDF", async () => {
    const file = makeFile(padBytes(EXE_MAGIC, 1024), "malware.pdf", "application/pdf");
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match");
  });

  test("rejects unknown content (plain text)", async () => {
    const textBytes = new TextEncoder().encode("just some text content without magic bytes");
    const file = makeFile(textBytes, "readme.pdf", "application/pdf");
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(false);
  });

  test("rejects empty file", async () => {
    const file = makeFile(new Uint8Array(0), "empty.pdf", "application/pdf");
    const result = await validateFileMagicBytes(file);
    expect(result.valid).toBe(false);
  });
});
