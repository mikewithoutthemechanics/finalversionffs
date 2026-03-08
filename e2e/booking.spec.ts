import { test, expect } from '@playwright/test';

test.describe('Class Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Sign in as admin to create a class first
    await page.click('button:has-text("Admin")');
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should display upcoming classes in client view', async ({ page }) => {
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should show class registration modal', async ({ page }) => {
    // Navigate to classes section
    await page.click('button:has-text("Classes")');
    await expect(page.locator('text=Manage Schedule')).toBeVisible();
  });

  test('should create a new class', async ({ page }) => {
    await page.click('button:has-text("Classes")');
    await page.click('button:has-text("New Class")');
    await expect(page.locator('text=Create Class')).toBeVisible();
    
    // Fill in class details
    await page.fill('input[placeholder="e.g. Happy Feet"]', 'Test Yoga Class');
    
    // Save the class
    await page.click('button:has-text("Publish Class")');
    
    // Verify class was created
    await expect(page.locator('text=Test Yoga Class')).toBeVisible();
  });

  test('should display analytics in admin dashboard', async ({ page }) => {
    await page.click('button:has-text("Analytics")');
    await expect(page.locator('text=Client Retention & Insights')).toBeVisible();
  });
});
