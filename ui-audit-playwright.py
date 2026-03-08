#!/usr/bin/env python3
"""
TFMD Booking App - Comprehensive UI/UX Audit Script
Uses Playwright to test the deployed preview URL
"""

from playwright.sync_api import sync_playwright, expect
import os
from datetime import datetime

# Configuration
BASE_URL = "https://tfmd-booking-7rxbrqcis-michael-s-projects-1c4584cf.vercel.app"
OUTPUT_DIR = "ui-audit-results"

# Viewport sizes for responsive testing
VIEWPORTS = {
    "desktop": {"width": 1920, "height": 1080},
    "laptop": {"width": 1366, "height": 768},
    "tablet": {"width": 768, "height": 1024},
    "mobile": {"width": 375, "height": 667},
    "mobile-lg": {"width": 414, "height": 896},
}

def ensure_dir(path):
    """Create directory if it doesn't exist"""
    os.makedirs(path, exist_ok=True)

def screenshot_path(name, viewport="desktop"):
    """Generate screenshot path"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{OUTPUT_DIR}/{viewport}_{name}_{timestamp}.png"

def run_audit():
    """Main audit function"""
    ensure_dir(OUTPUT_DIR)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Create browser context with specific viewport
        context = browser.new_context(
            viewport=VIEWPORTS["desktop"],
            device_scale_factor=1,
        )
        
        # Enable console logging
        context.on("console", lambda msg: print(f"[Console {msg.type}]: {msg.text}"))
        
        page = context.new_page()
        
        audit_results = {
            "pages_tested": [],
            "issues_found": [],
            "performance_metrics": {},
            "screenshots": []
        }
        
        print("=" * 60)
        print("TFMD BOOKING APP - UI/UX AUDIT")
        print("=" * 60)
        print(f"Target URL: {BASE_URL}")
        print(f"Output Directory: {OUTPUT_DIR}")
        print("=" * 60)
        
        # ==========================================
        # 1. HOME PAGE / SIGN-IN SCREEN
        # ==========================================
        print("\n📸 [1/6] Testing Home Page / Sign-In Screen...")
        try:
            page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)  # Wait for animations
            
            # Take full page screenshot
            path = screenshot_path("01_home_page")
            page.screenshot(path=path, full_page=True)
            audit_results["screenshots"].append(path)
            print(f"   ✅ Screenshot saved: {path}")
            
            # Check page title
            title = page.title()
            print(f"   📄 Page Title: {title}")
            
            # Check for key elements
            selectors_to_check = [
                ("text=Sign In", "Sign In button/link"),
                ("text=Sign Up", "Sign Up button/link"),
                ("[data-testid]", "Test IDs"),
                ("img", "Images"),
                ("button", "Buttons"),
                ("input", "Input fields"),
            ]
            
            for selector, desc in selectors_to_check:
                count = page.locator(selector).count()
                if count > 0:
                    print(f"   ✅ Found {count} {desc}")
            
            audit_results["pages_tested"].append("Home Page / Sign-In")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            audit_results["issues_found"].append(f"Home Page Error: {e}")
        
        # ==========================================
        # 2. TEST DIFFERENT VIEWPORTS
        # ==========================================
        print("\n📱 [2/6] Testing Responsive Layouts...")
        
        for viewport_name, size in VIEWPORTS.items():
            if viewport_name == "desktop":
                continue  # Already tested
                
            try:
                # Create new context with different viewport
                mobile_context = browser.new_context(viewport=size)
                mobile_page = mobile_context.new_page()
                
                mobile_page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
                mobile_page.wait_for_timeout(1500)
                
                path = screenshot_path("01_home_page", viewport_name)
                mobile_page.screenshot(path=path, full_page=True)
                audit_results["screenshots"].append(path)
                print(f"   ✅ {viewport_name} ({size['width']}x{size['height']}): {path}")
                
                mobile_context.close()
                
            except Exception as e:
                print(f"   ❌ {viewport_name} Error: {e}")
                audit_results["issues_found"].append(f"{viewport_name} viewport error: {e}")
        
        # ==========================================
        # 3. TRY NAVIGATING TO OTHER ROUTES
        # ==========================================
        print("\n🔗 [3/6] Testing Additional Routes...")
        
        routes_to_test = [
            ("/signin", "Sign In Page"),
            ("/signup", "Sign Up Page"),
            ("/client", "Client Dashboard"),
            ("/admin", "Admin Panel"),
            ("/trainer", "Trainer Dashboard"),
            ("/crm", "CRM Dashboard"),
        ]
        
        for route, name in routes_to_test:
            try:
                print(f"   Testing {name} ({route})...")
                page.goto(f"{BASE_URL}{route}", wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(2000)
                
                # Take screenshot
                safe_name = name.lower().replace(" ", "_")
                path = screenshot_path(f"02_{safe_name}")
                page.screenshot(path=path, full_page=True)
                audit_results["screenshots"].append(path)
                print(f"   ✅ {name} screenshot saved")
                
                # Check for common UI elements
                has_errors = page.locator("text=/error|failed|404|not found/i").count() > 0
                if has_errors:
                    error_text = page.locator("text=/error|failed|404|not found/i").first.text_content()
                    print(f"   ⚠️  Potential error detected: {error_text[:50]}")
                
                audit_results["pages_tested"].append(name)
                
            except Exception as e:
                print(f"   ⚠️  {name} not accessible: {e}")
                audit_results["issues_found"].append(f"{name} ({route}): {e}")
        
        # ==========================================
        # 4. ACCESSIBILITY CHECKS
        # ==========================================
        print("\n♿ [4/6] Running Accessibility Checks...")
        
        # Go back to home page
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        
        # Check for images without alt text
        images = page.locator("img").all()
        images_without_alt = []
        for img in images:
            alt = img.get_attribute("alt")
            if not alt:
                src = img.get_attribute("src") or "unknown"
                images_without_alt.append(src[:50])
        
        if images_without_alt:
            print(f"   ⚠️  Found {len(images_without_alt)} images without alt text")
            audit_results["issues_found"].append(f"Images without alt: {len(images_without_alt)}")
        else:
            print(f"   ✅ All images have alt text")
        
        # Check for form labels
        inputs = page.locator("input").all()
        unlabeled_inputs = []
        for inp in inputs:
            aria_label = inp.get_attribute("aria-label")
            placeholder = inp.get_attribute("placeholder")
            id_attr = inp.get_attribute("id")
            
            has_label = False
            if id_attr:
                label = page.locator(f"label[for='{id_attr}']").count() > 0
                has_label = label
            
            if not aria_label and not placeholder and not has_label:
                input_type = inp.get_attribute("type") or "text"
                unlabeled_inputs.append(input_type)
        
        if unlabeled_inputs:
            print(f"   ⚠️  Found {len(unlabeled_inputs)} inputs without labels")
            audit_results["issues_found"].append(f"Unlabeled inputs: {len(unlabeled_inputs)}")
        
        # Check button accessibility
        buttons = page.locator("button").all()
        buttons_without_text = []
        for btn in buttons:
            text = btn.text_content().strip()
            aria_label = btn.get_attribute("aria-label")
            if not text and not aria_label:
                buttons_without_text.append("button")
        
        if buttons_without_text:
            print(f"   ⚠️  Found {len(buttons_without_text)} buttons without text/aria-label")
            audit_results["issues_found"].append(f"Buttons without accessible text: {len(buttons_without_text)}")
        
        # Test keyboard navigation
        print("   Testing keyboard navigation...")
        page.keyboard.press("Tab")
        focused = page.evaluate("() => document.activeElement.tagName")
        if focused and focused != "BODY":
            print(f"   ✅ Tab navigation works (focused: {focused})")
        else:
            print(f"   ⚠️  Tab navigation may not be working properly")
        
        # ==========================================
        # 5. PERFORMANCE METRICS
        # ==========================================
        print("\n⚡ [5/6] Collecting Performance Metrics...")
        
        try:
            # Get performance metrics
            performance_timing = page.evaluate("""() => {
                const timing = performance.timing;
                return {
                    loadTime: timing.loadEventEnd - timing.navigationStart,
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
                    firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
                };
            """)
            
            audit_results["performance_metrics"] = performance_timing
            
            print(f"   ⏱️  Load Time: {performance_timing['loadTime']}ms")
            print(f"   ⏱️  DOM Content Loaded: {performance_timing['domContentLoaded']}ms")
            print(f"   🎨 First Paint: {performance_timing['firstPaint']}ms")
            print(f"   🎨 First Contentful Paint: {performance_timing['firstContentfulPaint']}ms")
            
        except Exception as e:
            print(f"   ⚠️  Could not collect performance metrics: {e}")
        
        # ==========================================
        # 6. UI ELEMENT ANALYSIS
        # ==========================================
        print("\n🔍 [6/6] Analyzing UI Elements...")
        
        # Check color contrast (basic check)
        elements_with_low_contrast = []
        
        # Get all text elements and their computed styles
        text_elements = page.locator("p, span, h1, h2, h3, h4, h5, h6, button, a, label").all()
        print(f"   Found {len(text_elements)} text elements")
        
        # Check form usability
        forms = page.locator("form").all()
        print(f"   Found {len(forms)} forms")
        
        # Check for loading states
        loading_indicators = page.locator("[class*='loading'], [class*='spinner'], [class*='skeleton']").count()
        if loading_indicators > 0:
            print(f"   ✅ Found {loading_indicators} loading indicators")
        
        # Check navigation
        nav_elements = page.locator("nav, [role='navigation']").all()
        print(f"   Found {len(nav_elements)} navigation elements")
        
        # Check for error messages display
        error_containers = page.locator("[class*='error'], [class*='alert'], [role='alert']").count()
        print(f"   Found {error_containers} error/alert containers")
        
        # ==========================================
        # GENERATE AUDIT REPORT
        # ==========================================
        print("\n" + "=" * 60)
        print("AUDIT SUMMARY")
        print("=" * 60)
        
        print(f"\n📄 Pages Tested: {len(audit_results['pages_tested'])}")
        for page_name in audit_results['pages_tested']:
            print(f"   - {page_name}")
        
        print(f"\n📸 Screenshots Captured: {len(audit_results['screenshots'])}")
        
        print(f"\n⚠️  Issues Found: {len(audit_results['issues_found'])}")
        for issue in audit_results['issues_found']:
            print(f"   - {issue}")
        
        if audit_results['performance_metrics']:
            print(f"\n⚡ Performance:")
            metrics = audit_results['performance_metrics']
            for key, value in metrics.items():
                print(f"   - {key}: {value}ms")
        
        browser.close()
        
        print("\n" + "=" * 60)
        print("AUDIT COMPLETE")
        print(f"Screenshots saved to: {OUTPUT_DIR}/")
        print("=" * 60)
        
        return audit_results

