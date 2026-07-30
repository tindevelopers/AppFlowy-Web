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
 * This spec runs directly against production (projects.tinconnect.com),
 * which is running the deployed fix (backend + frontend).
 */

const PROD_BASE = 'https://projects.tinconnect.com';

// Known published page in the "Clients" workspace, with a real published
// child so the scoped outline has actual content to assert against.
const NAMESPACE = '69c5bdee-caa8-4311-afb6-c46b535e230f';
const PUBLISH_NAME = 'Hello-World-t-b10614c8-9ee4-4302-815d-ea81a61efdd2';
const PUBLISHED_PAGE_NAME = 'Hello World test.';
const CHILD_VIEW_ID = '66d126c9-7758-410d-a458-7ba6b611a3c6';
const CHILD_PAGE_NAME = 'Share-Scope Fix Verification Child';

// Other published pages/spaces in the same workspace that must NOT leak
// into this page's sidebar.
const LEAKED_VIEW_IDS = [
  '926a4d64-ec8e-499a-993d-f07c3678f783', // Credentials (SnowLion Sushi space)
  'e1104ab9-4adc-42c9-ad5f-500499aae20b', // Droid. (Canada Lighting Supplies space)
  'b237e066-1e1b-408e-a1ac-18ea432e613c', // TIN Project SOP (General space)
  'fc4d0c43-1f2d-49a8-b131-f7a13caa79fc', // Lockd Client Portal Flow
];
const LEAKED_NAMES = [
  'Credentials',
  'Droid',
  'TIN Project SOP',
  'Lockd Client Portal Flow',
  'Canada Lighting Supplies',
  'SnowLion Sushi',
];

test.use({ channel: 'chrome' });

test.describe('Share-scope privacy — published outline', () => {
  test('scoped outline endpoint returns only the published page and its own child', async ({ request }) => {
    // Call the NEW scoped endpoint
    const scopedRes = await request.get(
      `${PROD_BASE}/api/workspace/published-outline/${NAMESPACE}/${PUBLISH_NAME}`,
      { failOnStatusCode: false }
    );
    expect(scopedRes.status()).toBe(200);
    const scopedBody = await scopedRes.json();
    const scopedData = scopedBody.data;

    // The root of the scoped tree should be the published page itself
    expect(scopedData.name.trim()).toBe(PUBLISHED_PAGE_NAME.trim());

    // Its own child IS included (proves the recursion still works)
    expect(scopedData.children).toHaveLength(1);
    expect(scopedData.children[0].view_id).toBe(CHILD_VIEW_ID);
    expect(scopedData.children[0].name).toBe(CHILD_PAGE_NAME);

    // Collect all view names/ids in the scoped tree
    const scopedNames: string[] = [];
    const scopedIds: string[] = [];
    const collect = (view: any) => {
      scopedNames.push(view.name);
      scopedIds.push(view.view_id);
      for (const child of view.children || []) {
        collect(child);
      }
    };
    collect(scopedData);

    // None of the other workspace pages/spaces should appear
    for (const leaked of LEAKED_NAMES) {
      expect(scopedNames).not.toContain(leaked);
    }
    for (const leakedId of LEAKED_VIEW_IDS) {
      expect(scopedIds).not.toContain(leakedId);
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

  test('production sidebar calls scoped endpoint and shows only this page + its child', async ({ page }) => {
    const outlineRequests: string[] = [];

    // Intercept all outline API calls
    page.on('request', (req) => {
      if (req.url().includes('published-outline')) {
        outlineRequests.push(req.url());
      }
    });

    // Navigate to the published page directly on production
    await page.goto(
      `${PROD_BASE}/${NAMESPACE}/${PUBLISH_NAME}`,
      { waitUntil: 'networkidle', timeout: 30000 }
    );

    // Give React time to render the sidebar outline
    await page.waitForTimeout(2000);

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

    // The sidebar renders each outline row with data-testid="outline-item-{view_id}".
    // The published page's own child MUST be visible.
    await expect(page.getByTestId(`outline-item-${CHILD_VIEW_ID}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`outline-item-${CHILD_VIEW_ID}`)).toContainText(CHILD_PAGE_NAME);

    // None of the other workspace's published pages must be present anywhere in the DOM.
    for (const leakedId of LEAKED_VIEW_IDS) {
      await expect(page.getByTestId(`outline-item-${leakedId}`)).toHaveCount(0);
    }

    // Belt-and-suspenders: none of the other space/page names should render
    // inside the sidebar outline container itself.
    const outlineText = await page.locator('.folder-views').first().textContent().catch(() => '');

    if (outlineText) {
      for (const leaked of LEAKED_NAMES) {
        expect(outlineText).not.toContain(leaked);
      }
    }

    await page.screenshot({ path: 'playwright/e2e/publish/share-scope-fix-verified.png', fullPage: true });
  });
});
