import { test, expect } from '@playwright/test';

test.describe('API Key creation', () => {
  test('should reach settings API access panel', async ({ page }) => {
    // Navigate to settings - API access
    await page.goto('/app/settings?tab=API_ACCESS');

    // Wait for the panel to load
    await page.waitForSelector('[data-testid="api-access-create-key"]', { timeout: 15000 });

    // Should see the create key button
    const createBtn = page.locator('[data-testid="api-access-create-key"]');
    await expect(createBtn).toBeVisible();

    // Click create and fill the form
    await createBtn.click();

    // Fill in the key name
    const nameInput = page.locator('[data-testid="api-key-name-input"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('test-key-playwright');

    // Submit
    const submitBtn = page.locator('[data-testid="api-key-create-submit"]');
    await submitBtn.click();

    // Wait for either success (key modal) or error toast
    try {
      // Success case: show-once key modal
      const keyValue = page.locator('[data-testid="api-key-created-value"]');
      await keyValue.waitFor({ timeout: 10000 });
      const text = await keyValue.textContent();
      console.log('SUCCESS: Created key:', text);
    } catch {
      // Error case: toast should appear
      // Check for sonner toast error
      const toast = page.locator('[data-sonner-toast]');
      await toast.waitFor({ timeout: 5000 });
      const toastText = await toast.textContent();
      console.log('ERROR TOAST:', toastText);
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'playwright/api-key-result.png', fullPage: true });
  });

  // Quick smoke test: just check the panel renders
  test('API access panel renders correctly', async ({ page }) => {
    await page.goto('/app/settings?tab=API_ACCESS');

    // Check connection info section
    await expect(page.locator('text=Connection')).toBeVisible({ timeout: 10000 });

    // Check API keys section
    await expect(page.locator('text=API Keys')).toBeVisible();

    // Check connection URLs are displayed
    const baseUrl = page.locator('text=projects.tinconnect.com').first();
    await expect(baseUrl).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'playwright/api-access-panel.png', fullPage: true });
  });
});
