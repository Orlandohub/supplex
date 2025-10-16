import { test, expect, type Page } from '@playwright/test';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123',
  fullName: 'Test User',
  tenantName: 'Test Company',
};

class AuthPage {
  constructor(private page: Page) {}

  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  async gotoLogin() {
    await this.page.goto('/login');
  }

  async gotoSignup() {
    await this.page.goto('/signup');
  }

  async gotoForgotPassword() {
    await this.page.goto('/forgot-password');
  }

  // Login actions
  async fillLoginForm(email: string, password: string, rememberMe = false) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    if (rememberMe) {
      await this.page.check('[name="rememberMe"]');
    }
  }

  async submitLogin() {
    await this.page.click('button[type="submit"]');
  }

  async login(email: string, password: string, rememberMe = false) {
    await this.fillLoginForm(email, password, rememberMe);
    await this.submitLogin();
  }

  // Signup actions
  async fillSignupForm(data: typeof testUser) {
    await this.page.fill('[name="email"]', data.email);
    await this.page.fill('[name="fullName"]', data.fullName);
    await this.page.fill('[name="tenantName"]', data.tenantName);
    await this.page.fill('[name="password"]', data.password);
    await this.page.fill('[name="confirmPassword"]', data.password);
    await this.page.check('[name="acceptTerms"]');
  }

  async submitSignup() {
    await this.page.click('button[type="submit"]');
  }

  async signup(data: typeof testUser) {
    await this.fillSignupForm(data);
    await this.submitSignup();
  }

  // Forgot password actions
  async fillForgotPasswordForm(email: string) {
    await this.page.fill('[name="email"]', email);
  }

  async submitForgotPassword() {
    await this.page.click('button[type="submit"]');
  }

  async forgotPassword(email: string) {
    await this.fillForgotPasswordForm(email);
    await this.submitForgotPassword();
  }

  // Logout
  async logout() {
    await this.page.click('button:has-text("Sign out"), a:has-text("Sign out")');
  }

  // Assertions
  async expectToBeOnLogin() {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.page.locator('h1')).toContainText('Welcome back');
  }

  async expectToBeOnSignup() {
    await expect(this.page).toHaveURL(/\/signup/);
    await expect(this.page.locator('h1')).toContainText('Create your account');
  }

  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/$/);
    await expect(this.page.locator('h1')).toContainText('Welcome to Supplex');
  }

  async expectToBeOnForgotPassword() {
    await expect(this.page).toHaveURL(/\/forgot-password/);
    await expect(this.page.locator('h1')).toContainText('Forgot password');
  }

  async expectErrorMessage(message: string) {
    await expect(this.page.locator('.text-red-600, .text-red-800')).toContainText(message);
  }

  async expectSuccessMessage(message: string) {
    await expect(this.page.locator('.text-green-600, .text-green-800')).toContainText(message);
  }

  async expectLoadingState() {
    await expect(this.page.locator('button[disabled]')).toBeVisible();
    await expect(this.page.locator('.animate-spin')).toBeVisible();
  }
}

test.describe('Authentication Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
  });

  test.describe('Login Page', () => {
    test('should display login form correctly', async ({ page }) => {
      await authPage.gotoLogin();
      
      // Check form elements
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[name="rememberMe"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check links
      await expect(page.locator('a:has-text("Forgot password")')).toBeVisible();
      await expect(page.locator('a:has-text("Sign up")')).toBeVisible();
      
      // Check OAuth buttons
      await expect(page.locator('button:has-text("Google")')).toBeVisible();
      await expect(page.locator('button:has-text("Microsoft")')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await authPage.gotoLogin();
      await authPage.submitLogin();
      
      await expect(page.locator('text=Email is required')).toBeVisible();
      await expect(page.locator('text=Password is required')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await authPage.gotoLogin();
      await authPage.fillLoginForm('invalid-email', 'password');
      await authPage.submitLogin();
      
      await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
    });

    test('should toggle password visibility', async ({ page }) => {
      await authPage.gotoLogin();
      
      const passwordInput = page.locator('input[name="password"]');
      const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should handle invalid credentials', async ({ page }) => {
      await authPage.gotoLogin();
      await authPage.login('nonexistent@example.com', 'wrongpassword');
      
      await authPage.expectErrorMessage('Invalid credentials');
    });

    test('should redirect to signup page', async ({ page }) => {
      await authPage.gotoLogin();
      await page.click('a:has-text("Sign up")');
      
      await authPage.expectToBeOnSignup();
    });

    test('should redirect to forgot password page', async ({ page }) => {
      await authPage.gotoLogin();
      await page.click('a:has-text("Forgot password")');
      
      await authPage.expectToBeOnForgotPassword();
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup form correctly', async ({ page }) => {
      await authPage.gotoSignup();
      
      // Check form elements
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="fullName"]')).toBeVisible();
      await expect(page.locator('input[name="tenantName"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
      await expect(page.locator('input[name="acceptTerms"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check OAuth buttons
      await expect(page.locator('button:has-text("Google")')).toBeVisible();
      await expect(page.locator('button:has-text("Microsoft")')).toBeVisible();
    });

    test('should validate all required fields', async ({ page }) => {
      await authPage.gotoSignup();
      await authPage.submitSignup();
      
      await expect(page.locator('text=Email is required')).toBeVisible();
      await expect(page.locator('text=Full name is required')).toBeVisible();
      await expect(page.locator('text=Company name is required')).toBeVisible();
      await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
      await expect(page.locator('text=Please confirm your password')).toBeVisible();
      await expect(page.locator('text=You must accept the terms and conditions')).toBeVisible();
    });

    test('should validate password confirmation', async ({ page }) => {
      await authPage.gotoSignup();
      
      await page.fill('[name="password"]', 'Password123');
      await page.fill('[name="confirmPassword"]', 'DifferentPassword');
      await authPage.submitSignup();
      
      await expect(page.locator('text=Passwords don\'t match')).toBeVisible();
    });

    test('should show password strength indicator', async ({ page }) => {
      await authPage.gotoSignup();
      
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill('weak');
      
      // Should show weak password indicator
      await expect(page.locator('.text-red-600:has-text("Weak")')).toBeVisible();
      
      await passwordInput.fill('StrongPassword123');
      
      // Should show strong password indicator
      await expect(page.locator('.text-green-600:has-text("Strong")')).toBeVisible();
    });

    test('should redirect to login page', async ({ page }) => {
      await authPage.gotoSignup();
      await page.click('a:has-text("Sign in")');
      
      await authPage.expectToBeOnLogin();
    });
  });

  test.describe('Forgot Password Page', () => {
    test('should display forgot password form correctly', async ({ page }) => {
      await authPage.gotoForgotPassword();
      
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      await expect(page.locator('a:has-text("Back to sign in")')).toBeVisible();
    });

    test('should validate email field', async ({ page }) => {
      await authPage.gotoForgotPassword();
      await authPage.submitForgotPassword();
      
      await expect(page.locator('text=Email is required')).toBeVisible();
    });

    test('should show success message after submission', async ({ page }) => {
      await authPage.gotoForgotPassword();
      await authPage.forgotPassword('test@example.com');
      
      // Should show success state (this would depend on your implementation)
      await expect(page.locator('h1:has-text("Check your email")')).toBeVisible();
    });

    test('should navigate back to login', async ({ page }) => {
      await authPage.gotoForgotPassword();
      await page.click('a:has-text("Back to sign in")');
      
      await authPage.expectToBeOnLogin();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await authPage.goto('/');
      
      // Should redirect to login
      await authPage.expectToBeOnLogin();
    });

    test('should preserve redirect URL after login', async ({ page }) => {
      // Try to access protected route
      await authPage.goto('/dashboard');
      
      // Should redirect to login with redirectTo parameter
      await expect(page).toHaveURL(/\/login\?redirectTo=/);
      
      // After successful login, should redirect back to intended page
      // This would require a valid user account to test properly
    });
  });

  test.describe('Navigation and UX', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
      await authPage.gotoLogin();
      
      // Form should be visible and usable on mobile
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should handle keyboard navigation', async ({ page }) => {
      await authPage.gotoLogin();
      
      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="email"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="password"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="rememberMe"]')).toBeFocused();
    });

    test('should show loading states during form submission', async ({ page }) => {
      await authPage.gotoLogin();
      await authPage.fillLoginForm('test@example.com', 'password123');
      
      // Click submit and immediately check for loading state
      const submitPromise = authPage.submitLogin();
      
      // Should show loading spinner and disabled button
      await authPage.expectLoadingState();
      
      await submitPromise;
    });
  });
});
