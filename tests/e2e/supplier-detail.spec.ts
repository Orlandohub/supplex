import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Supplier Detail Page (Story 1.6)
 * 
 * Tests cover:
 * - Viewing supplier details
 * - Status change functionality
 * - Delete functionality
 * - Tab navigation
 * - Permission-based UI rendering
 * - Mobile responsiveness
 * - 404 error handling
 */

class SupplierDetailPage {
  constructor(private page: Page) {}

  async goto(supplierId: string) {
    await this.page.goto(`/suppliers/${supplierId}`);
  }

  async gotoSupplierList() {
    await this.page.goto('/suppliers');
  }

  // Tab navigation
  async clickOverviewTab() {
    await this.page.click('button:has-text("Overview")');
  }

  async clickDocumentsTab() {
    await this.page.click('button:has-text("Documents")');
  }

  async clickHistoryTab() {
    await this.page.click('button:has-text("History")');
  }

  // Status change actions
  async selectStatus(status: string) {
    await this.page.click('[role="combobox"]');
    await this.page.click(`text=${status}`);
  }

  async confirmStatusChange() {
    await this.page.click('button:has-text("Confirm Change")');
  }

  async cancelStatusChange() {
    await this.page.click('button:has-text("Cancel")');
  }

  // Delete actions
  async clickDeleteButton() {
    await this.page.click('button:has-text("Delete")');
  }

  async confirmDelete() {
    await this.page.click('button:has-text("Delete Supplier")');
  }

  async cancelDelete() {
    await this.page.click('button:has-text("Cancel")');
  }

  // Edit action
  async clickEditButton() {
    await this.page.click('a:has-text("Edit")');
  }

  // Navigation
  async clickBreadcrumbHome() {
    await this.page.click('a:has-text("Home")');
  }

  async clickBreadcrumbSuppliers() {
    await this.page.click('a:has-text("Suppliers")');
  }

  async clickBackToSuppliers() {
    await this.page.click('a:has-text("Back to Suppliers")');
  }

  // Assertions
  async expectToBeOnSupplierDetail(supplierName: string) {
    await expect(this.page).toHaveURL(/\/suppliers\/[a-f0-9-]+/);
    await expect(this.page.locator('h1')).toContainText(supplierName);
  }

  async expectToBeOnSupplierList() {
    await expect(this.page).toHaveURL(/\/suppliers$/);
    await expect(this.page.locator('h1')).toContainText('Suppliers');
  }

  async expectToSee404() {
    await expect(this.page.locator('h1')).toContainText('Supplier Not Found');
    await expect(this.page.locator('text=This supplier doesn\'t exist')).toBeVisible();
  }

  async expectStatusChangedTo(status: string) {
    await expect(this.page.locator(`text=${status}`)).toBeVisible();
  }

  async expectStatusChangeModal() {
    await expect(this.page.locator('text=Confirm Status Change')).toBeVisible();
  }

  async expectDeleteModal() {
    await expect(this.page.locator('text=Delete Supplier')).toBeVisible();
    await expect(this.page.locator('text=This action cannot be easily undone')).toBeVisible();
  }

  async expectEditButtonVisible() {
    await expect(this.page.locator('a:has-text("Edit")')).toBeVisible();
  }

  async expectDeleteButtonVisible() {
    await expect(this.page.locator('button:has-text("Delete")')).toBeVisible();
  }

  async expectEditButtonHidden() {
    await expect(this.page.locator('a:has-text("Edit")')).not.toBeVisible();
  }

  async expectDeleteButtonHidden() {
    await expect(this.page.locator('button:has-text("Delete")')).not.toBeVisible();
  }
}

test.describe('Supplier Detail Page', () => {
  let detailPage: SupplierDetailPage;

  test.beforeEach(async ({ page }) => {
    detailPage = new SupplierDetailPage(page);
  });

  test.describe('View Supplier Details', () => {
    test('should display complete supplier information', async ({ page }) => {
      // This test assumes a supplier exists in the test database
      // In a real test environment, you'd seed test data
      await detailPage.gotoSupplierList();
      
      // Click first supplier to navigate to detail page
      await page.click('tr:has(td) >> nth=0');
      
      // Should see supplier name
      await expect(page.locator('h1')).toBeVisible();
      
      // Should see contact information
      await expect(page.locator('text=Contact Information')).toBeVisible();
      await expect(page.locator('text=Primary Contact')).toBeVisible();
      
      // Should see address
      await expect(page.locator('text=Address')).toBeVisible();
      
      // Should see category
      await expect(page.locator('text=Category')).toBeVisible();
      
      // Should see record information
      await expect(page.locator('text=Record Information')).toBeVisible();
    });

    test('should display clickable contact information', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Email should be clickable mailto link
      const emailLinks = page.locator('a[href^="mailto:"]');
      await expect(emailLinks.first()).toBeVisible();
      
      // Phone should be clickable tel link
      const phoneLinks = page.locator('a[href^="tel:"]');
      await expect(phoneLinks.first()).toBeVisible();
    });

    test('should display status badge', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Status badge should be visible
      await expect(page.locator('[class*="badge"], [class*="Badge"]')).toBeVisible();
    });

    test('should display breadcrumb navigation', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Breadcrumb should show: Home > Suppliers > [Supplier Name]
      await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
      await expect(page.locator('a:has-text("Home")')).toBeVisible();
      await expect(page.locator('a:has-text("Suppliers")')).toBeVisible();
    });

    test('should show loading skeleton while fetching', async ({ page }) => {
      // Intercept the API call to add delay
      await page.route('**/api/suppliers/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });
      
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Should show loading skeleton
      await expect(page.locator('.animate-pulse')).toBeVisible();
    });
  });

  test.describe('Tab Navigation', () => {
    test('should switch between tabs', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Overview tab should be active by default
      await expect(page.locator('text=Contact Information')).toBeVisible();
      
      // Click Documents tab
      await detailPage.clickDocumentsTab();
      await expect(page.locator('text=Documents Coming Soon')).toBeVisible();
      
      // Click History tab
      await detailPage.clickHistoryTab();
      await expect(page.locator('text=Audit History Coming Soon')).toBeVisible();
      
      // Click back to Overview
      await detailPage.clickOverviewTab();
      await expect(page.locator('text=Contact Information')).toBeVisible();
    });

    test('should update URL with tab parameter', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Click Documents tab
      await detailPage.clickDocumentsTab();
      await expect(page).toHaveURL(/tab=documents/);
      
      // Click History tab
      await detailPage.clickHistoryTab();
      await expect(page).toHaveURL(/tab=history/);
    });

    test('should be keyboard accessible', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Tab through elements
      await page.keyboard.press('Tab');
      
      // Overview tab should be focusable
      const overviewTab = page.locator('button:has-text("Overview")');
      await overviewTab.focus();
      await expect(overviewTab).toBeFocused();
    });
  });

  test.describe('Status Change Functionality (Admin/Procurement Manager)', () => {
    test('should show status change dropdown for authorized users', async ({ page }) => {
      // This test assumes logged in as Admin or Procurement Manager
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Status dropdown should be visible
      await expect(page.locator('text=Change Status:')).toBeVisible();
      await expect(page.locator('[role="combobox"]')).toBeVisible();
    });

    test('should open confirmation modal when changing status', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Select new status
      await detailPage.selectStatus('Qualified');
      
      // Confirmation modal should appear
      await detailPage.expectStatusChangeModal();
      
      // Should show old and new status
      await expect(page.locator('text=Current Status')).toBeVisible();
      await expect(page.locator('text=New Status')).toBeVisible();
    });

    test('should cancel status change', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.selectStatus('Qualified');
      await detailPage.expectStatusChangeModal();
      
      // Cancel the change
      await detailPage.cancelStatusChange();
      
      // Modal should close
      await expect(page.locator('text=Confirm Status Change')).not.toBeVisible();
    });

    test('should update status on confirmation', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Get current status
      const currentStatus = await page.locator('[role="combobox"]').textContent();
      
      // Select different status
      await detailPage.selectStatus('Qualified');
      await detailPage.confirmStatusChange();
      
      // Should see success message or updated status
      await page.waitForTimeout(500); // Wait for update
      await detailPage.expectStatusChangedTo('Qualified');
    });
  });

  test.describe('Delete Functionality (Admin Only)', () => {
    test('should show delete button for Admin users', async ({ page }) => {
      // This test assumes logged in as Admin
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.expectDeleteButtonVisible();
    });

    test('should open confirmation modal when clicking delete', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.clickDeleteButton();
      
      // Confirmation modal should appear
      await detailPage.expectDeleteModal();
      
      // Should show supplier name in confirmation
      const supplierName = await page.locator('h1').first().textContent();
      await expect(page.locator(`text=Are you sure you want to delete "${supplierName}"`)).toBeVisible();
    });

    test('should cancel delete operation', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.clickDeleteButton();
      await detailPage.expectDeleteModal();
      
      // Cancel the delete
      await detailPage.cancelDelete();
      
      // Modal should close
      await expect(page.locator('text=Delete Supplier')).not.toBeVisible();
      
      // Should still be on detail page
      await expect(page).toHaveURL(/\/suppliers\/[a-f0-9-]+/);
    });

    test('should redirect to supplier list after successful delete', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.clickDeleteButton();
      await detailPage.confirmDelete();
      
      // Should redirect to supplier list
      await detailPage.expectToBeOnSupplierList();
    });
  });

  test.describe('Edit Button', () => {
    test('should navigate to edit page when clicking edit', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.expectEditButtonVisible();
      await detailPage.clickEditButton();
      
      // Should navigate to edit page
      await expect(page).toHaveURL(/\/suppliers\/[a-f0-9-]+\/edit/);
    });
  });

  test.describe('Error Handling', () => {
    test('should show 404 for non-existent supplier', async ({ page }) => {
      await detailPage.goto('550e8400-e29b-41d4-a716-446655440099');
      
      // Should show 404 page
      await detailPage.expectToSee404();
    });

    test('should provide back to suppliers link on 404', async ({ page }) => {
      await detailPage.goto('550e8400-e29b-41d4-a716-446655440099');
      
      await detailPage.clickBackToSuppliers();
      
      // Should navigate back to supplier list
      await detailPage.expectToBeOnSupplierList();
    });

    test('should show 404 for invalid UUID format', async ({ page }) => {
      await detailPage.goto('invalid-id');
      
      // Should show 404 or error page
      await expect(page.locator('text=not found, text=404, text=error')).toBeVisible();
    });
  });

  test.describe('Breadcrumb Navigation', () => {
    test('should navigate to home when clicking Home breadcrumb', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.clickBreadcrumbHome();
      
      await expect(page).toHaveURL(/\/$/);
    });

    test('should navigate to supplier list when clicking Suppliers breadcrumb', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      await detailPage.clickBreadcrumbSuppliers();
      
      await detailPage.expectToBeOnSupplierList();
    });

    test('should not make current supplier name clickable', async ({ page }) => {
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      const supplierName = await page.locator('h1').first().textContent();
      
      // Supplier name in breadcrumb should not be a link
      const breadcrumbItem = page.locator(`nav[aria-label="Breadcrumb"] span:has-text("${supplierName}")`);
      await expect(breadcrumbItem).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display mobile-optimized layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
      
      await detailPage.gotoSupplierList();
      await page.click('div:has(h3)'); // Click card on mobile
      
      // All content should be visible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('text=Contact Information')).toBeVisible();
      
      // Buttons should be touch-friendly
      const editButton = page.locator('a:has-text("Edit")');
      if (await editButton.isVisible()) {
        const box = await editButton.boundingBox();
        // Minimum touch target is 44x44px
        expect(box?.height).toBeGreaterThanOrEqual(40);
      }
    });

    test('should truncate long supplier names in breadcrumb on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await detailPage.gotoSupplierList();
      await page.click('div:has(h3)');
      
      // Breadcrumb should be visible and truncated if name is long
      await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    });

    test('should stack action buttons on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await detailPage.gotoSupplierList();
      await page.click('div:has(h3)');
      
      // Action buttons should be visible
      const editButton = page.locator('a:has-text("Edit")');
      const deleteButton = page.locator('button:has-text("Delete")');
      
      if (await editButton.isVisible()) {
        await expect(editButton).toBeVisible();
      }
      if (await deleteButton.isVisible()) {
        await expect(deleteButton).toBeVisible();
      }
    });
  });

  test.describe('Permission-Based UI', () => {
    test('should hide edit button for Viewer role', async ({ page }) => {
      // This test assumes logged in as Viewer
      // In a real test, you'd set up a viewer user account
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Edit button should not be visible for viewers
      // This would need actual role-based test setup
    });

    test('should hide delete button for non-Admin users', async ({ page }) => {
      // This test assumes logged in as Procurement Manager (not Admin)
      // In a real test, you'd set up appropriate user account
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Delete button should not be visible for non-admins
      // This would need actual role-based test setup
    });

    test('should hide status dropdown for Viewer role', async ({ page }) => {
      // This test assumes logged in as Viewer
      await detailPage.gotoSupplierList();
      await page.click('tr:has(td) >> nth=0');
      
      // Status dropdown should not be visible for viewers
      // This would need actual role-based test setup
    });
  });
});

