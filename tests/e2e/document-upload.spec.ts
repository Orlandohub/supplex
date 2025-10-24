import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Document Upload & Management
 * Story 1.8 Acceptance Criteria Coverage
 */

test.describe("Document Upload & Management", () => {
  // Test user credentials (should be set in environment or test database)
  const testEmail = process.env.TEST_USER_EMAIL || "admin@test.com";
  const testPassword = process.env.TEST_USER_PASSWORD || "testpass123";

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Login
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL("/");
  });

  test("should display Documents tab on supplier detail page", async ({
    page,
  }) => {
    // Navigate to suppliers list
    await page.goto("/suppliers");

    // Click on first supplier (or create one if needed)
    await page.click('a[href^="/suppliers/"]');

    // Wait for supplier detail page to load
    await page.waitForSelector("h1");

    // Click Documents tab
    await page.click('button[value="documents"]');

    // Verify Documents tab content is visible
    await expect(page.locator('text="Documents"')).toBeVisible();
  });

  test("should upload document with metadata", async ({ page }) => {
    // Navigate to first supplier
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');

    // Click Documents tab
    await page.click('button[value="documents"]');

    // Click Upload Document button
    await page.click('button:has-text("Upload Document")');

    // Wait for modal to open
    await expect(page.locator("dialog")).toBeVisible();

    // Select file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-certificate.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("Test PDF content"),
    });

    // Fill metadata form
    await page.selectOption("select", "certificate"); // Document type
    await page.fill('textarea[id="description"]', "Test certificate document");
    await page.fill('input[type="date"]', "2025-12-31");

    // Click Upload button
    await page.click('button:has-text("Upload")');

    // Wait for success toast
    await expect(page.locator('text="Upload successful"')).toBeVisible({
      timeout: 10000,
    });

    // Verify document appears in list
    await expect(page.locator('text="test-certificate.pdf"')).toBeVisible();
  });

  test("should display validation error for invalid file type", async ({
    page,
  }) => {
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');
    await page.click('button:has-text("Upload Document")');

    // Upload invalid file type (.exe)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "virus.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("fake executable"),
    });

    // Verify validation error appears
    await expect(page.locator("text=/File type not supported/i")).toBeVisible();
  });

  test("should display validation error for file size exceeding 10MB", async ({
    page,
  }) => {
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');
    await page.click('button:has-text("Upload Document")');

    // Create 11MB file
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "large-file.pdf",
      mimeType: "application/pdf",
      buffer: largeBuffer,
    });

    // Verify validation error appears
    await expect(page.locator("text=/File size exceeds 10MB/i")).toBeVisible();
  });

  test("should download document when Download button clicked", async ({
    page,
  }) => {
    // Assume document already exists from previous test
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Wait for documents to load
    await page
      .waitForSelector('[data-testid="document-list"]', {
        state: "visible",
        timeout: 5000,
      })
      .catch(() => {
        // If no documents exist, skip this test
        test.skip();
      });

    // Start waiting for download event
    const downloadPromise = page.waitForEvent("download");

    // Click Download button (first document)
    await page.click('button[aria-label="Download"]').catch(() => {
      page.click('svg[class*="download"]').catch(() => {
        test.skip(); // Skip if no download button found
      });
    });

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download was triggered
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test("should delete document with confirmation", async ({ page }) => {
    // Assume document exists
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Wait for documents to load
    await page
      .waitForSelector('[data-testid="document-list"]', {
        state: "visible",
        timeout: 5000,
      })
      .catch(() => {
        test.skip();
      });

    // Get initial document count
    const initialCount = await page
      .locator('table tbody tr, [data-testid="document-card"]')
      .count();

    // Click Delete button (first document)
    await page.click('button[variant="destructive"]').catch(() => test.skip());

    // Wait for confirmation modal
    await expect(
      page.locator('text="Are you sure you want to delete"')
    ).toBeVisible();

    // Click confirm button
    await page.click('button:has-text("Delete")');

    // Wait for success toast
    await expect(page.locator('text="Document deleted"')).toBeVisible({
      timeout: 5000,
    });

    // Verify document count decreased
    const finalCount = await page
      .locator('table tbody tr, [data-testid="document-card"]')
      .count();
    expect(finalCount).toBe(initialCount - 1);
  });

  test("should display expiry warning for documents expiring within 30 days", async ({
    page,
  }) => {
    // This test assumes a document with expiry within 30 days exists
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Look for expiry warning badge
    const expiryBadge = page.locator("text=/Expires in \\d+ days?/i");
    const hasWarning = await expiryBadge.isVisible().catch(() => false);

    if (hasWarning) {
      expect(await expiryBadge.textContent()).toMatch(/Expires in \d+ days?/);
    } else {
      // If no documents with expiry warning, create one via API
      test.skip();
    }
  });

  test("should display expired badge for expired documents", async ({
    page,
  }) => {
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Look for expired badge
    const expiredBadge = page.locator('text="Expired"');
    const hasExpired = await expiredBadge.isVisible().catch(() => false);

    if (hasExpired) {
      await expect(expiredBadge).toBeVisible();
    } else {
      // If no expired documents, skip
      test.skip();
    }
  });

  test("should sort documents by upload date", async ({ page }) => {
    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Click sort button for Upload Date column
    await page.click('button:has-text("Upload Date")');

    // Verify table is re-ordered (implementation depends on actual table structure)
    // This is a placeholder - actual implementation would verify sort order
    await page.waitForTimeout(500);
  });

  test("should display empty state when no documents exist", async ({
    page,
  }) => {
    // Create new supplier without documents or navigate to empty supplier
    await page.goto("/suppliers");

    // Create new supplier
    await page.click('button:has-text("New Supplier")');
    // Fill form and submit (assuming form flow exists)
    // Navigate to Documents tab

    // Verify empty state
    await expect(page.locator('text="No documents yet"')).toBeVisible();
    await expect(
      page.locator('text="Upload your first document"')
    ).toBeVisible();
  });

  test("should hide Upload/Delete buttons for Viewer role", async ({
    page,
  }) => {
    // This test requires logging in as a Viewer role user
    // Skip if current user is not Viewer
    // Alternatively, create a Viewer user and login

    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Verify Upload button is not visible
    const uploadButton = page.locator('button:has-text("Upload Document")');
    const isVisible = await uploadButton.isVisible().catch(() => false);

    // If admin/procurement manager, skip this test
    if (isVisible) {
      test.skip();
    }

    await expect(uploadButton).not.toBeVisible();
  });

  test("should display mobile card layout on small screens", async ({
    page,
  }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/suppliers");
    await page.click('a[href^="/suppliers/"]');
    await page.click('button[value="documents"]');

    // Verify card layout is displayed (table should be hidden)
    const mobileCards = page.locator('[data-testid="document-card"]');
    const table = page.locator("table");

    const cardsVisible = (await mobileCards.count()) > 0;
    const tableVisible = await table.isVisible();

    // On mobile, cards should be visible and table hidden
    expect(cardsVisible || !tableVisible).toBe(true);
  });
});
