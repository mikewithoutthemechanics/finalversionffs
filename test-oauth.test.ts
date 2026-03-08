import { test, expect } from '@playwright/test';

test('OAuth Sign-In Flow Test', async ({ page }) => {
  console.log('Navigating to http://localhost:3000...');
  
  // Navigate to the app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Take screenshot of sign-in page
  await page.screenshot({ path: 'test-results/oauth-signin-page.png' });
  console.log('Screenshot saved to test-results/oauth-signin-page.png');
  
  // Find Google sign-in button
  const googleButton = page.locator('button:has-text("Sign in with Google")');
  
  // Assert button exists
  await expect(googleButton).toBeVisible();
  console.log('✓ Google sign-in button found');
  
  // Click the button
  console.log('Clicking Google sign-in button...');
  await googleButton.click();
  
  // Wait to see what happens
  await page.waitForTimeout(3000);
  
  // Get current URL
  const currentUrl = page.url();
  console.log('Current URL after clicking:', currentUrl);
  
  // Take screenshot after click
  await page.screenshot({ path: 'test-results/oauth-after-click.png' });
  
  // Check if redirected to OAuth
  if (currentUrl.includes('google') || currentUrl.includes('accounts.google.com')) {
    console.log('✓ Successfully redirected to Google OAuth!');
  } else if (currentUrl.includes('supabase')) {
    console.log('✓ Redirected to Supabase OAuth');
  } else {
    // Check for error messages
    const errorLocator = page.locator('.text-red-200');
    const errorCount = await errorLocator.count();
    if (errorCount > 0) {
      const errorText = await errorLocator.first().textContent();
      console.log('⚠ Error message displayed:', errorText);
    } else {
      console.log('No error displayed - OAuth flow may have started');
    }
  }
});
