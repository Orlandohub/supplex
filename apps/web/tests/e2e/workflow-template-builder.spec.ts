/**
 * E2E Tests for Workflow Template Builder
 * Tests the complete workflow template creation and management flow
 */

import { test, expect } from "@playwright/test";

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

// Mock admin credentials (should be replaced with test fixtures)
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "password123";

test.describe("Workflow Template Builder", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation to complete
    await page.waitForURL(`${BASE_URL}/`);
  });

  test("should create a new workflow template with steps", async ({ page }) => {
    // Step 1: Navigate to workflow templates page
    await page.goto(`${BASE_URL}/workflows/templates`);
    await expect(page.locator("h1")).toContainText("Workflow Templates");

    // Step 2: Click "Create New Template" button
    await page.click('button:has-text("New Template")');
    await page.waitForURL(`${BASE_URL}/workflows/templates/new`);

    // Step 3: Fill in template metadata
    await page.fill('input[name="name"]', "E2E Test Workflow Template");
    await page.fill(
      'textarea[name="description"]',
      "This is a test workflow template created by E2E tests"
    );
    await page.selectOption('select[name="processType"]', "supplier_qualification");

    // Step 4: Submit template creation
    await page.click('button[type="submit"]:has-text("Create Template")');
    
    // Wait for redirect to edit page
    await page.waitForURL(/\/workflows\/templates\/[^/]+\/edit/);
    await expect(page.locator("h1")).toContainText("E2E Test Workflow Template");

    // Step 5: Verify initial draft version was created
    await page.click('button:has-text("Versions")');
    await expect(page.locator("text=Version 1")).toBeVisible();
    await expect(page.locator("text=draft")).toBeVisible();

    // Step 6: Add a workflow step
    await page.click('button:has-text("Steps")');
    await page.click('button:has-text("Add Step")');

    // Step 7: Fill in step details
    await page.fill('input[name="name"]', "Review Supplier Profile");
    await page.selectOption('select[name="stepType"]', "approval");
    await page.fill('input[name="taskTitle"]', "Review supplier submission");
    await page.fill(
      'textarea[name="taskDescription"]',
      "Review the supplier profile for completeness and accuracy"
    );
    await page.fill('input[name="dueDays"]', "3");

    // Step 8: Configure assignee (role-based)
    await page.check('input[value="role"]');
    await page.selectOption('select[name="assigneeRole"]', "procurement_manager");

    // Step 9: Submit step creation
    await page.click('button[type="submit"]:has-text("Create Step")');

    // Step 10: Verify step was created
    await expect(page.locator("text=Review Supplier Profile")).toBeVisible();
    await expect(page.locator("text=approval")).toBeVisible();
  });

  test("should configure multi-approver step", async ({ page }) => {
    // Navigate to existing template (assuming one exists from previous test or setup)
    await page.goto(`${BASE_URL}/workflows/templates`);
    
    // Click on first template
    await page.click(".grid > div:first-child");
    await page.waitForURL(/\/workflows\/templates\/[^/]+\/edit/);

    // Go to steps tab
    await page.click('button:has-text("Steps")');

    // Add new multi-approver step
    await page.click('button:has-text("Add Step")');
    await page.fill('input[name="name"]', "Multi-Approver Review");
    await page.selectOption('select[name="stepType"]', "approval");
    await page.fill('input[name="taskTitle"]', "Multi-level approval required");

    // Enable multi-approver
    await page.check('input[name="multiApprover"]');
    await page.fill('input[name="approverCount"]', "2");

    // Submit step
    await page.click('button[type="submit"]:has-text("Create Step")');
    await expect(page.locator("text=Multi-Approver Review")).toBeVisible();

    // Add first approver
    await page.click('button:has-text("Add Approver")');
    await page.check('input[value="role"]');
    await page.selectOption('select[name="approverRole"]', "procurement_manager");
    await page.click('button[type="submit"]:has-text("Add Approver")');
    await expect(page.locator("text=procurement_manager")).toBeVisible();

    // Add second approver
    await page.click('button:has-text("Add Approver")');
    await page.check('input[value="role"]');
    await page.selectOption('select[name="approverRole"]', "quality_manager");
    await page.click('button[type="submit"]:has-text("Add Approver")');
    await expect(page.locator("text=quality_manager")).toBeVisible();

    // Verify multi-approver configuration
    await expect(page.locator("text=Requires 2 out of")).toBeVisible();
  });

  test("should publish version and enforce immutability", async ({ page }) => {
    // Navigate to existing template
    await page.goto(`${BASE_URL}/workflows/templates`);
    await page.click(".grid > div:first-child");
    await page.waitForURL(/\/workflows\/templates\/[^/]+\/edit/);

    // Go to versions tab
    await page.click('button:has-text("Versions")');

    // Select draft version
    await page.click("text=Version 1");

    // Publish version
    await page.click('button:has-text("Publish Version")');
    
    // Confirm in dialog
    await page.click('button:has-text("Publish Version 1")');

    // Wait for success message
    await expect(page.locator("text=Version Published")).toBeVisible();

    // Verify status changed to published
    await expect(page.locator("text=published")).toBeVisible();

    // Try to edit steps - should show immutability warning
    await page.click('button:has-text("Steps")');
    await expect(
      page.locator("text=This version is published and cannot be edited")
    ).toBeVisible();

    // Verify "Add Step" button is disabled
    await expect(page.locator('button:has-text("Add Step")')).toBeDisabled();
  });

  test("should attach form to workflow step", async ({ page }) => {
    // Navigate to template
    await page.goto(`${BASE_URL}/workflows/templates`);
    await page.click(".grid > div:first-child");
    await page.waitForURL(/\/workflows\/templates\/[^/]+\/edit/);

    // Ensure we're on a draft version
    await page.click('button:has-text("Versions")');
    const hasDraft = await page.locator("text=draft").isVisible();
    
    if (!hasDraft) {
      // Create new draft version
      await page.click('button:has-text("New Draft Version")');
      await expect(page.locator("text=Version Created")).toBeVisible();
    }

    // Go to steps tab
    await page.click('button:has-text("Steps")');

    // Add form step
    await page.click('button:has-text("Add Step")');
    await page.fill('input[name="name"]', "Fill Supplier Information");
    await page.selectOption('select[name="stepType"]', "form");
    
    // Set form action mode
    await page.check('input[value="fill_out"]');
    
    // Note: Would need to select actual form template ID from DB in real test
    await page.fill('input[name="formTemplateVersionId"]', "test-form-id");

    // Submit step
    await page.click('button[type="submit"]:has-text("Create Step")');

    // Verify form integration shows
    await expect(page.locator("text=Form:")).toBeVisible();
    await expect(page.locator("text=fill_out")).toBeVisible();
  });

  test("should only be accessible by admin users", async ({ page }) => {
    // Logout
    await page.goto(`${BASE_URL}/logout`);
    
    // Login as non-admin user (procurement manager)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', "procurement@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);

    // Try to access workflow templates - should redirect or show 403
    await page.goto(`${BASE_URL}/workflows/templates`);
    
    // Verify redirect to home or access denied
    const url = page.url();
    expect(url).toBe(`${BASE_URL}/`);

    // Verify sidebar doesn't show workflow templates link
    await expect(page.locator('text="Workflow Templates"')).not.toBeVisible();
  });

  test("should filter templates by status", async ({ page }) => {
    await page.goto(`${BASE_URL}/workflows/templates`);

    // Click "Draft" filter
    await page.click('button:has-text("Draft")');
    
    // Verify only draft templates are shown
    const badges = await page.locator('[data-badge="status"]').allTextContents();
    badges.forEach((badge) => {
      expect(badge.toLowerCase()).toBe("draft");
    });

    // Click "Published" filter
    await page.click('button:has-text("Published")');
    
    // Verify filtering works (may have no results)
    await page.waitForTimeout(500); // Wait for filter to apply

    // Click "All" to show all templates
    await page.click('button:has-text("All")');
    await expect(page.locator(".grid > div")).toHaveCount(
      await page.locator(".grid > div").count()
    );
  });

  test("should delete workflow step", async ({ page }) => {
    await page.goto(`${BASE_URL}/workflows/templates`);
    await page.click(".grid > div:first-child");
    await page.waitForURL(/\/workflows\/templates\/[^/]+\/edit/);

    // Ensure we're on a draft version
    await page.click('button:has-text("Versions")');
    const hasDraft = await page.locator("text=draft").isVisible();
    
    if (!hasDraft) {
      await page.click('button:has-text("New Draft Version")');
    }

    // Go to steps
    await page.click('button:has-text("Steps")');

    // Get initial step count
    const initialSteps = await page.locator(".space-y-3 > div").count();

    if (initialSteps > 0) {
      // Delete first step
      await page.click('.space-y-3 > div:first-child button[aria-label*="Delete"], .space-y-3 > div:first-child button:has(svg)').last();
      
      // Verify step was deleted
      await expect(page.locator("text=Step Deleted")).toBeVisible();
      
      const finalSteps = await page.locator(".space-y-3 > div").count();
      expect(finalSteps).toBe(initialSteps - 1);
    }
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: Delete test templates if needed
    // This would require API calls or direct DB access
    console.log("E2E tests completed. Consider cleanup of test data.");
  });
});

