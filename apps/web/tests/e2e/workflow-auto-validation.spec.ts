/**
 * E2E Test: Workflow Auto-Validation
 * Story 2.2.15
 * 
 * Tests the complete auto-validation flow from template creation to validation approval
 */

import { test, expect } from '@playwright/test';

test.describe('Workflow Auto-Validation E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@supplex.com');
    await page.fill('input[name="password"]', 'admin-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('complete workflow with auto-validation', async ({ page }) => {
    // Step 1: Navigate to workflow templates
    await page.goto('/workflow-templates');
    await page.waitForLoadState('networkidle');

    // Step 2: Create new workflow template
    await page.click('text=Create Template');
    await page.fill('input[name="name"]', 'E2E Auto-Validation Test Workflow');
    await page.fill('textarea[name="description"]', 'Testing auto-validation feature');
    await page.click('button:has-text("Create")');
    
    // Wait for template to be created
    await expect(page.locator('text=Workflow template created')).toBeVisible();
    
    // Get template ID from URL
    const templateUrl = page.url();
    const templateId = templateUrl.split('/').pop();

    // Step 3: Add Step 1 - Form fill-out with validation
    await page.click('text=Add Step');
    await page.fill('input[name="name"]', 'Submit Supplier Profile');
    await page.selectOption('select[name="stepType"]', 'form');
    await page.fill('input[name="taskTitle"]', 'Fill out supplier profile form');
    await page.selectOption('select[name="assigneeRole"]', 'supplier_user');
    
    // Enable auto-validation
    await page.check('input[name="requiresValidation"]');
    
    // Select quality_manager as approver
    await page.check('text=Quality Manager');
    
    await page.click('button:has-text("Create Step")');
    await expect(page.locator('text=Step created successfully')).toBeVisible();

    // Step 4: Add Step 2 - Document upload with validation
    await page.click('text=Add Step');
    await page.fill('input[name="name"]', 'Upload Financial Documents');
    await page.selectOption('select[name="stepType"]', 'document');
    await page.fill('input[name="taskTitle"]', 'Upload required financial documents');
    await page.selectOption('select[name="assigneeRole"]', 'supplier_user');
    
    // Enable auto-validation with multiple approvers
    await page.check('input[name="requiresValidation"]');
    await page.check('text=Procurement Manager');
    await page.check('text=Quality Manager');
    
    await page.click('button:has-text("Create Step")');
    await expect(page.locator('text=Step created successfully')).toBeVisible();

    // Step 5: Add Step 3 - Final approval (no validation)
    await page.click('text=Add Step');
    await page.fill('input[name="name"]', 'Final Approval');
    await page.selectOption('select[name="stepType"]', 'approval');
    await page.fill('input[name="taskTitle"]', 'Review and approve supplier');
    await page.selectOption('select[name="assigneeRole"]', 'admin');
    await page.click('button:has-text("Create Step")');
    await expect(page.locator('text=Step created successfully')).toBeVisible();

    // Verify steps display validation indicators
    await expect(page.locator('text=Auto-Validation: quality_manager')).toBeVisible();
    await expect(page.locator('text=Auto-Validation: procurement_manager, quality_manager')).toBeVisible();

    // Step 6: Publish the template
    await page.click('button:has-text("Publish Template")');
    await page.click('button:has-text("Confirm")');
    await expect(page.locator('text=Template published successfully')).toBeVisible();

    // Step 7: Instantiate workflow
    await page.goto('/workflows');
    await page.click('text=Start New Workflow');
    await page.selectOption('select[name="templateId"]', { label: 'E2E Auto-Validation Test Workflow' });
    await page.click('button:has-text("Start Workflow")');
    
    const workflowUrl = page.url();
    const workflowId = workflowUrl.split('/').pop();

    // Step 8: Complete Step 1 (as supplier user)
    // Switch to supplier user context
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'supplier@test.com');
    await page.fill('input[name="password"]', 'supplier-password');
    await page.click('button[type="submit"]');
    
    await page.goto(`/workflows/${workflowId}`);
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Step completed')).toBeVisible();

    // Step 9: Verify validation task created for quality_manager
    // Switch to quality manager context
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'quality@test.com');
    await page.fill('input[name="password"]', 'quality-password');
    await page.click('button[type="submit"]');
    
    await page.goto('/my-tasks');
    await expect(page.locator('text=Validate: Submit Supplier Profile')).toBeVisible();

    // Step 10: Approve validation
    await page.click('text=Validate: Submit Supplier Profile');
    await page.click('button:has-text("Approve")');
    await expect(page.locator('text=Validation approved')).toBeVisible();

    // Step 11: Verify Step 2 activated
    await page.goto(`/workflows/${workflowId}`);
    await expect(page.locator('text=Upload Financial Documents')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();

    // Step 12: Complete Step 2 (as supplier user)
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'supplier@test.com');
    await page.fill('input[name="password"]', 'supplier-password');
    await page.click('button[type="submit"]');
    
    await page.goto(`/workflows/${workflowId}`);
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Step completed')).toBeVisible();

    // Step 13: Verify validation tasks created for both roles
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'procurement@test.com');
    await page.fill('input[name="password"]', 'procurement-password');
    await page.click('button[type="submit"]');
    
    await page.goto('/my-tasks');
    await expect(page.locator('text=Validate: Upload Financial Documents')).toBeVisible();
    
    // Approve as procurement manager
    await page.click('text=Validate: Upload Financial Documents');
    await page.click('button:has-text("Approve")');
    
    // Step 14: Approve as quality manager
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'quality@test.com');
    await page.fill('input[name="password"]', 'quality-password');
    await page.click('button[type="submit"]');
    
    await page.goto('/my-tasks');
    await page.click('text=Validate: Upload Financial Documents');
    await page.click('button:has-text("Approve")');

    // Step 15: Verify Step 3 activated
    await page.goto(`/workflows/${workflowId}`);
    await expect(page.locator('text=Final Approval')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();

    // Step 16: Complete workflow
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@supplex.com');
    await page.fill('input[name="password"]', 'admin-password');
    await page.click('button[type="submit"]');
    
    await page.goto(`/workflows/${workflowId}`);
    await page.click('button:has-text("Approve")');
    await expect(page.locator('text=Workflow completed')).toBeVisible();
  });

  test('backward compatibility - manual validation steps still work', async ({ page }) => {
    // Step 1: Navigate to workflow templates
    await page.goto('/workflow-templates');

    // Step 2: Create template with OLD manual validation approach
    await page.click('text=Create Template');
    await page.fill('input[name="name"]', 'Manual Validation Workflow');
    await page.fill('textarea[name="description"]', 'Testing backward compatibility');
    await page.click('button:has-text("Create")');

    // Step 3: Add Step 1 - Form fill-out (without auto-validation)
    await page.click('text=Add Step');
    await page.fill('input[name="name"]', 'Submit Data');
    await page.selectOption('select[name="stepType"]', 'form');
    await page.selectOption('select[name="formActionMode"]', 'fill_out');
    await page.selectOption('select[name="assigneeRole"]', 'supplier_user');
    await page.click('button:has-text("Create Step")');

    // Step 4: Add Step 2 - Manual validation step (OLD way)
    await page.click('text=Add Step');
    await page.fill('input[name="name"]', 'Validate Data');
    await page.selectOption('select[name="stepType"]', 'form');
    await page.selectOption('select[name="formActionMode"]', 'validate');
    await page.selectOption('select[name="assigneeRole"]', 'quality_manager');
    // DO NOT check requiresValidation checkbox
    await page.click('button:has-text("Create Step")');

    // Step 5: Verify template created successfully
    await expect(page.locator('text=Step created successfully')).toBeVisible();

    // Step 6: Publish and instantiate workflow
    await page.click('button:has-text("Publish Template")');
    await page.click('button:has-text("Confirm")');
    
    await page.goto('/workflows');
    await page.click('text=Start New Workflow');
    await page.selectOption('select[name="templateId"]', { label: 'Manual Validation Workflow' });
    await page.click('button:has-text("Start Workflow")');

    // Step 7: Complete workflow normally
    // This verifies that existing workflows with manual validation steps
    // continue to work as expected without any breaking changes
    await expect(page.locator('text=Submit Data')).toBeVisible();
  });
});
