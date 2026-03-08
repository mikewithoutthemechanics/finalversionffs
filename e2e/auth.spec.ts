import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display sign in screen', async ({ page }) => {
    await expect(page.locator('text=Pause')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should show admin sign in button', async ({ page }) => {
    await expect(page.locator('button:has-text("Admin")')).toBeVisible();
  });

  test('should show trainer sign in button', async ({ page }) => {
    await expect(page.locator('button:has-text("Trainer")')).toBeVisible();
  });

  test('should navigate to admin dashboard on admin sign in', async ({ page }) => {
    await page.click('button:has-text("Admin")');
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Platform Overview')).toBeVisible();
  });

  test('should navigate to trainer dashboard on trainer sign in', async ({ page }) => {
    await page.click('button:has-text("Trainer")');
    await expect(page.locator('text=My Classes')).toBeVisible({ timeout: 10000 });
  });
});
