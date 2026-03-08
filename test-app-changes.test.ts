import { chromium } from 'playwright';

const BASE_URL = 'https://tfmd-booking-app.vercel.app';

async function testAppChanges() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  
  const page = await context.newPage();
  
  const consoleErrors: string[] = [];
  
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', (error: any) => {
    consoleErrors.push('Page error: ' + error.message);
  });

  try {
    // TEST 1: Sign-in Screen
    console.log('\n=== TEST 1: Sign-in Screen ===');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/signin-screen.png', fullPage: true });
    console.log('Screenshot saved: test-results/signin-screen.png');
    
    const pageContent = await page.content();
    
    const hasGoogleButton = pageContent.toLowerCase().includes('google');
    console.log('Google button present: ' + hasGoogleButton);
    
    const hasFacebookButton = pageContent.toLowerCase().includes('facebook');
    console.log('Facebook button present: ' + hasFacebookButton);
    
    const hasAppleButton = pageContent.toLowerCase().includes('apple');
    console.log('Apple button present: ' + hasAppleButton);
    
    const oauthButtons = await page.locator('button').all();
    console.log('Total buttons found: ' + oauthButtons.length);
    
    for (const button of oauthButtons) {
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      console.log('Button: ' + (text || ariaLabel || 'no text'));
    }

    // TEST 2: Onboarding Flow
    console.log('\n=== TEST 2: Onboarding Screen ===');
    
    await page.goto(BASE_URL + '/onboarding', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/onboarding-screen.png', fullPage: true });
    console.log('Screenshot saved: test-results/onboarding-screen.png');
    
    const onboardingContent = await page.content();
    const hasWaiver = onboardingContent.toLowerCase().includes('waiver');
    const hasInjuries = onboardingContent.toLowerCase().includes('injuries') || onboardingContent.toLowerCase().includes('injury');
    const hasGoals = onboardingContent.toLowerCase().includes('goal');
    
    console.log('Waiver step present: ' + hasWaiver);
    console.log('Injuries step present: ' + hasInjuries);
    console.log('Goals step present (should be false): ' + hasGoals);
    
    // TEST 3: Bottom Navigation Menu
    console.log('\n=== TEST 3: Bottom Navigation Menu ===');
    
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL + '/client', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/bottom-nav-menu.png', fullPage: true });
    console.log('Screenshot saved: test-results/bottom-nav-menu.png');
    
    const bottomNavText = await page.locator('nav').last().textContent().catch(() => 'No nav found');
    console.log('Bottom nav text: ' + bottomNavText);
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Sign-in Screen:');
    console.log('  - Google button: ' + (hasGoogleButton ? 'PASS' : 'FAIL'));
    console.log('  - Facebook button: ' + (hasFacebookButton ? 'PASS' : 'FAIL'));
    console.log('  - Apple button: ' + (hasAppleButton ? 'PASS' : 'FAIL'));
    
    console.log('\nOnboarding Flow:');
    console.log('  - Waiver step: ' + (hasWaiver ? 'PASS' : 'FAIL'));
    console.log('  - Injuries step: ' + (hasInjuries ? 'PASS' : 'FAIL'));
    console.log('  - Goals step removed: ' + (!hasGoals ? 'PASS' : 'FAIL'));
    
    console.log('\nConsole Errors:');
    if (consoleErrors.length === 0) {
      console.log('  No critical errors found');
    } else {
      consoleErrors.forEach(function(err) { console.log('  - ' + err); });
    }
    
  } catch (error: any) {
    console.error('Test error: ' + error.message);
    await page.screenshot({ path: 'test-results/error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testAppChanges();
