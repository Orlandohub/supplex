/**
 * Server-Side File Validation via Magic Bytes
 * Story 2.2.20 — Upload Hardening (C7)
 *
 * Detects the real file type from content bytes rather than trusting
 * the client-provided Content-Type header.
 */

import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * ZIP-based Office formats (docx, xlsx) share the same magic bytes as generic ZIP.
 * Map the declared MIME to the expected magic-byte MIME so we can accept them.
 */
const ZIP_OFFICE_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * ZIP local-file-header magic bytes: PK\x03\x04
 * Used as a fallback when file-type's deep ZIP inspection fails
 * (e.g. Bun lacks DecompressionStream "deflate-raw" support).
 */
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export async function validateFileMagicBytes(
  file: File
): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  let detected: { ext: string; mime: string } | undefined;
  try {
    detected = await fileTypeFromBuffer(buffer);
  } catch {
    // file-type uses DecompressionStream("deflate-raw") for ZIP inspection,
    // which Bun does not support. Fall back to raw magic-byte check.
    if (buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
      if (ZIP_OFFICE_MIMES.has(file.type)) {
        return { valid: true, detectedType: file.type };
      }
      return {
        valid: false,
        detectedType: "application/zip",
        error: `File type validation failed: detected ZIP archive but declared Content-Type (${file.type}) is not an allowed Office format`,
      };
    }
    return {
      valid: false,
      error: "Could not detect file type from content",
    };
  }

  if (!detected) {
    return {
      valid: false,
      error: "Could not detect file type from content",
    };
  }

  // Direct match against allowed list
  if (ALLOWED_MIME_TYPES.includes(detected.mime)) {
    return { valid: true, detectedType: detected.mime };
  }

  // ZIP-based Office files: file-type detects them as application/zip
  if (
    detected.mime === "application/zip" &&
    ZIP_OFFICE_MIMES.has(file.type)
  ) {
    return { valid: true, detectedType: file.type };
  }

  // Compound Binary Format (.doc, .xls): file-type detects as application/x-cfb
  if (
    detected.mime === "application/x-cfb" &&
    (file.type === "application/msword" ||
      file.type === "application/vnd.ms-excel")
  ) {
    return { valid: true, detectedType: file.type };
  }

  return {
    valid: false,
    detectedType: detected.mime,
    error: `File type validation failed: detected type (${detected.mime}) does not match declared Content-Type (${file.type})`,
  };
}
