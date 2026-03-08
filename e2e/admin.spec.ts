import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin")');
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should display admin dashboard with stats', async ({ page }) => {
    await expect(page.locator('text=Platform Overview')).toBeVisible();
    await expect(page.locator('text=Total Members')).toBeVisible();
  });

  test('should navigate to analytics section', async ({ page }) => {
    await page.click('button:has-text("Analytics")');
    await expect(page.locator('text=Client Retention & Insights')).toBeVisible();
  });

  test('should navigate to classes section', async ({ page }) => {
    await page.click('button:has-text("Classes")');
    await expect(page.locator('text=Manage Schedule')).toBeVisible();
  });

  test('should navigate to attendees section', async ({ page }) => {
    await page.click('button:has-text("Attendees")');
    await expect(page.locator('text=Verification & Lists')).toBeVisible();
  });

  test('should navigate to CRM section', async ({ page }) => {
    await page.click('button:has-text("CRM")');
    // CRM is lazy loaded
    await expect(page.locator('text=Dashboard', { hasText: 'CRM' })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to venues section', async ({ page }) => {
    await page.click('button:has-text("Venues")');
    await expect(page.locator('text=Manage Locations')).toBeVisible();
  });

  test('should navigate to instructors section', async ({ page }) => {
    await page.click('button:has-text("Instructors")');
    await expect(page.locator('text=Manage Teaching Staff')).toBeVisible();
  });

  test('should navigate to templates section', async ({ page }) => {
    await page.click('button:has-text("Templates")');
    await expect(page.locator('text=Communication Presets')).toBeVisible();
  });

  test('should sign out and return to sign in', async ({ page }) => {
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should show quick actions on dashboard', async ({ page }) => {
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=New Class')).toBeVisible();
    await expect(page.locator('text=Verify Pay')).toBeVisible();
  });
});
