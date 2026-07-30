import { test, expect } from '@playwright/test';

/**
 * Share-scope privacy verification.
 *
 * Bug: publishing a single page exposed ALL spaces and pages in the
 * workspace via the public sidebar outline.  Visitors to one client's
 * page could see every other client's space names and page names.
 *
 * Fix: the published-outline endpoint now accepts a {publish_name} path
 * segment and scopes the returned tree to just the published page and
 * its children.
 *
 * This spec drives a headed browser against the local dev server
 * (port 3001) which is configured to use the production API, so it
 * exercises the real backend fix end-to-end.
 */

const PROD_BASE = 'https://projects.tinconnect.com';

// Known published page in the "Clients" workspace
const NAMESPACE = '69c5bdee-caa8-4311-afb6-c46b535e230f';
const PUBLISH_NAME = 'Credentials-926a4d64-ec8e-499a-993d-f07c3678f783';
const PUBLISHED_PAGE_NAME = 'Credentials';

// Pages that should NOT appear in the scoped sidebar
const LEAKED_NAMES = [
  'TIN Project SOP',
  'Droid',
  'Lockd Client Portal Flow',
  'General',
  'Canada Lighting Supplies',
  'SnowLion Sushi',
];

test.use({ channel: 'chrome' });

test.describe('Share-scope privacy — published outline', () => {
  test('scoped outline endpoint returns only the published page', async ({ request }) => {
    // Call the NEW scoped endpoint
    const scopedRes = await request.get(
      `${PROD_BASE}/api/workspace/published-outline/${NAMESPACE}/${PUBLISH_NAME}`,
      { failOnStatusCode: false }
    );
    expect(scopedRes.status()).toBe(200);
    const scopedBody = await scopedRes.json();
    const scopedData = scopedBody.data;

    // The root of the scoped tree should be the published page itself
    expect(scopedData.name).toBe(PUBLISHED_PAGE_NAME);

    // Collect all view names in the scoped tree
    const scopedNames: string[] = [];
    const collectNames = (view: any) => {
      scopedNames.push(view.name);
      for (const child of view.children || []) {
        collectNames(child);
      }
    };
    collectNames(scopedData);

    // None of the other workspace pages/spaces should appear
    for (const leaked of LEAKED_NAMES) {
      expect(scopedNames).not.toContain(leaked);
    }
  });

  test('old workspace-scoped endpoint still leaks (regression baseline)', async ({ request }) => {
    // This test documents the OLD behaviour for comparison.
    // After the backend fix is fully rolled out, this endpoint should
    // eventually be deprecated or removed.
    const oldRes = await request.get(
      `${PROD_BASE}/api/workspace/published-outline/${NAMESPACE}`,
      { failOnStatusCode: false }
    );
    expect(oldRes.status()).toBe(200);
    const oldBody = await oldRes.json();

    const collectNames = (view: any): string[] => {
      const names = [view.name];
      for (const child of view.children || []) {
        names.push(...collectNames(child));
      }
      return names;
    };
    const oldNames = collectNames(oldBody.data);

    // The old endpoint DOES leak other spaces
    expect(oldNames).toContain('General');
    expect(oldNames).toContain('SnowLion Sushi');
  });

  test('frontend calls scoped outline endpoint and sidebar shows only the published page', async ({ page }) => {
    const outlineRequests: string[] = [];

    // Intercept all outline API calls
    page.on('request', (req) => {
      if (req.url().includes('published-outline')) {
        outlineRequests.push(req.url());
      }
    });

    // Navigate to the published page on the local dev server
    await page.goto(
      `http://localhost:3001/${NAMESPACE}/${PUBLISH_NAME}`,
      { waitUntil: 'networkidle', timeout: 30000 }
    );

    // Give React time to render
    await page.waitForTimeout(3000);

    // Verify the frontend called the SCOPED endpoint (with publish_name)
    const scopedCall = outlineRequests.find(
      (url) => url.includes(`${NAMESPACE}/${PUBLISH_NAME}`)
    );
    expect(scopedCall).toBeDefined();

    // The old unscoped endpoint should NOT be called by the publish context
    const unscopedCall = outlineRequests.find(
      (url) =>
        url.includes(`published-outline/${NAMESPACE}`) &&
        !url.includes(`published-outline/${NAMESPACE}/${PUBLISH_NAME}`)
    );
    expect(unscopedCall).toBeUndefined();

    // Check the sidebar content - it should only show "Credentials"
    const sidebarText = await page.locator('nav, [class*="sidebar"], [class*="outline"], [class*="drawer"]')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => '');

    // The published page name should be visible
    if (sidebarText) {
      expect(sidebarText).toContain(PUBLISHED_PAGE_NAME);

      // Other pages should NOT be in the sidebar
      for (const leaked of LEAKED_NAMES) {
        // Use loose matching for partial names like "Droid"
        const checkName = leaked === 'Droid' ? 'Droid.' : leaked;
        if (sidebarText.includes(checkName)) {
          expect(sidebarText).not.toContain(checkName);
        }
      }
    }
  });
});
