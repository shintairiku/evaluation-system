import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for accessibility testing
    await page.route('**/api/auth/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-user', role: 'admin' }
        })
      });
    });

    // Mock APIs for consistent testing
    await page.route('**/api/v1/stages/admin', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'stage-1', name: 'ステージ1', description: '初期ステージ', userCount: 2 }
          ]
        })
      });
    });

    await page.route('**/api/v1/users?**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'user-1',
                name: '田中太郎',
                code: 'EMP001',
                email: 'tanaka@example.com',
                department: { id: 'dept-1', name: '開発部' },
                role: { id: 'role-1', name: 'エンジニア' }
              }
            ],
            total: 1
          }
        })
      });
    });
  });

  test('stage management page should be accessible', async ({ page }) => {
    await page.goto('/stage-management');

    // Wait for content to load
    await expect(page.locator('h1')).toContainText('ステージ管理');

    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('main')
      .exclude('[data-testid="loading-spinner"]') // Exclude loading states
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('competency management page should be accessible', async ({ page }) => {
    // Mock competency management API
    await page.route('**/api/v1/competencies/management**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            competencies: {
              items: [
                {
                  id: 'comp-1',
                  name: 'コミュニケーション',
                  description: {
                    basic: '基本的なコミュニケーション',
                    intermediate: '効果的なコミュニケーション',
                    advanced: 'リーダーシップコミュニケーション'
                  },
                  stageId: 'stage-1'
                }
              ],
              total: 1
            },
            stages: [
              { id: 'stage-1', name: 'ステージ1', description: '初期ステージ' }
            ]
          }
        })
      });
    });

    await page.goto('/competency-management');

    // Wait for content to load
    await expect(page.locator('h1')).toContainText('コンピテンシー管理');

    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('main')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('competency modal should be accessible', async ({ page }) => {
    // Setup for competency management
    await page.route('**/api/v1/competencies/management**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            competencies: {
              items: [
                {
                  id: 'comp-1',
                  name: 'コミュニケーション',
                  description: {
                    basic: '基本的なコミュニケーション',
                    intermediate: '効果的なコミュニケーション',
                    advanced: 'リーダーシップコミュニケーション'
                  },
                  stageId: 'stage-1'
                }
              ],
              total: 1
            },
            stages: [
              { id: 'stage-1', name: 'ステージ1', description: '初期ステージ' }
            ]
          }
        })
      });
    });

    await page.goto('/competency-management');

    // Open competency modal
    await page.locator('text=コミュニケーション').click();

    // Wait for modal to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Run accessibility scan on modal
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('drag and drop should be accessible', async ({ page }) => {
    await page.goto('/stage-management');

    // Wait for content to load
    await expect(page.locator('[data-testid="user-card-user-1"]')).toBeVisible();

    // Check that draggable elements have proper ARIA attributes
    const userCard = page.locator('[data-testid="user-card-user-1"]');
    await expect(userCard).toHaveAttribute('draggable', 'true');
    await expect(userCard).toHaveAttribute('role', 'button');
    await expect(userCard).toHaveAttribute('aria-label');

    // Check that drop zones have proper ARIA attributes
    const stageColumn = page.locator('[data-testid="stage-column-stage-1"]');
    await expect(stageColumn).toHaveAttribute('role', 'region');
    await expect(stageColumn).toHaveAttribute('aria-label');

    // Run accessibility scan on drag and drop area
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid^="stage-column"]')
      .include('[data-testid^="user-card"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('keyboard navigation should work properly', async ({ page }) => {
    await page.goto('/stage-management');

    // Test tab navigation
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Test that all interactive elements are reachable via keyboard
    let tabCount = 0;
    const maxTabs = 20; // Prevent infinite loop

    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      tabCount++;

      const currentFocus = page.locator(':focus');
      if (await currentFocus.count() === 0) {
        break;
      }

      // Check that focused element is visible
      await expect(currentFocus).toBeVisible();
    }

    // Test escape key functionality
    await page.keyboard.press('Escape');

    // Test enter key on interactive elements
    const firstButton = page.locator('button').first();
    await firstButton.focus();
    // Note: We don't press Enter here to avoid triggering actions
  });

  test('screen reader landmarks should be present', async ({ page }) => {
    await page.goto('/stage-management');

    // Check for proper landmark structure
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('[role="banner"], header')).toBeVisible();
    await expect(page.locator('[role="navigation"], nav')).toBeVisible();

    // Check for proper heading hierarchy
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);

    // Run comprehensive accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('color contrast should meet WCAG standards', async ({ page }) => {
    await page.goto('/stage-management');

    // Run accessibility scan focusing on color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('mobile accessibility should be maintained', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/stage-management');

    // Wait for content to load
    await expect(page.locator('h1')).toContainText('ステージ管理');

    // Run accessibility scan on mobile
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Check touch targets are large enough (minimum 44px)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const boundingBox = await button.boundingBox();
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });
});