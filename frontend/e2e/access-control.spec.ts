import { test, expect } from '@playwright/test';

test.describe('Access Control E2E Tests', () => {
  test.describe('Admin Access Control', () => {
    test.beforeEach(async ({ page }) => {
      // Mock admin user authentication
      await page.route('**/api/auth/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'admin-user', role: 'admin' }
          })
        });
      });

      // Mock successful admin API responses
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

      await page.route('**/api/v1/competencies/management**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              competencies: { items: [], total: 0 },
              stages: []
            }
          })
        });
      });
    });

    test('admin should access stage management page', async ({ page }) => {
      await page.goto('/stage-management');

      // Should successfully load the page
      await expect(page.locator('h1')).toContainText('ステージ管理');

      // Should see admin controls
      await expect(page.locator('[data-testid="stage-management-header"]')).toBeVisible();
    });

    test('admin should access competency management page', async ({ page }) => {
      await page.goto('/competency-management');

      // Should successfully load the page
      await expect(page.locator('h1')).toContainText('コンピテンシー管理');

      // Should see admin controls
      await expect(page.locator('button:has-text("新規作成")')).toBeVisible();
    });
  });

  test.describe('Non-Admin Access Denial', () => {
    test.beforeEach(async ({ page }) => {
      // Mock non-admin user authentication
      await page.route('**/api/auth/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'regular-user', role: 'employee' }
          })
        });
      });

      // Mock 403 responses for admin endpoints
      await page.route('**/api/v1/stages/admin', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Access denied: Insufficient permissions'
          })
        });
      });

      await page.route('**/api/v1/competencies/management**', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Access denied: Insufficient permissions'
          })
        });
      });
    });

    test('non-admin should be denied access to stage management', async ({ page }) => {
      await page.goto('/stage-management');

      // Should show access denied message
      await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();
      await expect(page.locator('text=You don\'t have admin permissions')).toBeVisible();

      // Should not see stage management interface
      await expect(page.locator('[data-testid="stage-management-header"]')).not.toBeVisible();
    });

    test('non-admin should be denied access to competency management', async ({ page }) => {
      await page.goto('/competency-management');

      // Should show access denied message
      await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();
      await expect(page.locator('text=You don\'t have admin permissions')).toBeVisible();

      // Should not see competency management interface
      await expect(page.locator('button:has-text("新規作成")')).not.toBeVisible();
    });
  });

  test.describe('Viewer Access Control', () => {
    test.beforeEach(async ({ page }) => {
      // Mock viewer user authentication
      await page.route('**/api/auth/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'viewer-user', role: 'viewer' }
          })
        });
      });

      // Mock successful viewer API responses for competency management
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

      // Mock 403 for stage management (viewers can't access)
      await page.route('**/api/v1/stages/admin', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Access denied: Insufficient permissions'
          })
        });
      });
    });

    test('viewer should access competency management in read-only mode', async ({ page }) => {
      await page.goto('/competency-management');

      // Should successfully load the page
      await expect(page.locator('h1')).toContainText('コンピテンシー管理');

      // Should see competencies but no edit controls
      await expect(page.locator('text=コミュニケーション')).toBeVisible();

      // Should NOT see admin controls (create button)
      await expect(page.locator('button:has-text("新規作成")')).not.toBeVisible();
    });

    test('viewer should be denied access to stage management', async ({ page }) => {
      await page.goto('/stage-management');

      // Should show access denied message
      await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();

      // Should not see stage management interface
      await expect(page.locator('[data-testid="stage-management-header"]')).not.toBeVisible();
    });

    test('viewer should see read-only competency details', async ({ page }) => {
      await page.goto('/competency-management');

      // Click on competency to view details
      await page.locator('text=コミュニケーション').click();

      // Should open modal in read-only mode
      await expect(page.locator('[data-testid="competency-modal"]')).toBeVisible();

      // Should see competency information
      await expect(page.locator('text=基本的なコミュニケーション')).toBeVisible();

      // Should NOT see edit/delete buttons
      await expect(page.locator('button:has-text("保存")')).not.toBeVisible();
      await expect(page.locator('button:has-text("削除")')).not.toBeVisible();

      // Should see close button only
      await expect(page.locator('button:has-text("閉じる")')).toBeVisible();
    });
  });

  test.describe('Unauthenticated Access', () => {
    test.beforeEach(async ({ page }) => {
      // Mock unauthenticated state
      await page.route('**/api/auth/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized'
          })
        });
      });

      // Mock 401 responses for all protected endpoints
      await page.route('**/api/v1/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Authentication required'
          })
        });
      });
    });

    test('unauthenticated user should be redirected to login', async ({ page }) => {
      await page.goto('/stage-management');

      // Should redirect to login page or show login prompt
      await expect(page.locator('text=Please sign in')).toBeVisible({ timeout: 10000 });
    });

    test('unauthenticated user should not access competency management', async ({ page }) => {
      await page.goto('/competency-management');

      // Should redirect to login page or show login prompt
      await expect(page.locator('text=Please sign in')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Session Management', () => {
    test('should handle session expiration gracefully', async ({ page }) => {
      // Start with valid session
      await page.route('**/api/auth/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'admin-user', role: 'admin' }
          })
        });
      });

      await page.goto('/stage-management');
      await expect(page.locator('h1')).toContainText('ステージ管理');

      // Simulate session expiration
      await page.route('**/api/v1/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Session expired'
          })
        });
      });

      // Try to perform an action that requires authentication
      const searchInput = page.locator('input[placeholder*="検索"]');
      await searchInput.fill('test');

      // Should show session expired message or redirect to login
      await expect(page.locator('text=Session expired')).toBeVisible({ timeout: 10000 });
    });
  });
});