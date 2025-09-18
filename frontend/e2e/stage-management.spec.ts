import { test, expect } from '@playwright/test';

test.describe('Stage Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for testing
    await page.route('**/api/auth/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-user', role: 'admin' }
        })
      });
    });

    // Mock stages API
    await page.route('**/api/v1/stages/admin', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'stage-1',
              name: 'ステージ1',
              description: '初期ステージ',
              userCount: 2
            },
            {
              id: 'stage-2',
              name: 'ステージ2',
              description: '中級ステージ',
              userCount: 1
            }
          ]
        })
      });
    });

    // Mock users API
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
              },
              {
                id: 'user-2',
                name: '佐藤花子',
                code: 'EMP002',
                email: 'sato@example.com',
                department: { id: 'dept-1', name: '開発部' },
                role: { id: 'role-1', name: 'エンジニア' }
              }
            ],
            total: 2
          }
        })
      });
    });

    await page.goto('/stage-management');
  });

  test('should load stage management page for admin user', async ({ page }) => {
    // Verify page loads correctly
    await expect(page.locator('h1')).toContainText('ステージ管理');

    // Verify stages are displayed
    await expect(page.locator('[data-testid="stage-column-stage-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-column-stage-2"]')).toBeVisible();

    // Verify stage names
    await expect(page.locator('text=ステージ1')).toBeVisible();
    await expect(page.locator('text=ステージ2')).toBeVisible();
  });

  test('should display users in correct stages', async ({ page }) => {
    // Verify users are displayed
    await expect(page.locator('text=田中太郎')).toBeVisible();
    await expect(page.locator('text=佐藤花子')).toBeVisible();

    // Verify user details
    await expect(page.locator('text=EMP001')).toBeVisible();
    await expect(page.locator('text=tanaka@example.com')).toBeVisible();
  });

  test('should perform drag and drop operation', async ({ page }) => {
    // Mock the update API call
    await page.route('**/api/v1/stage-management/users/stages', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Find user card and target stage
    const userCard = page.locator('[data-testid="user-card-user-1"]');
    const targetStage = page.locator('[data-testid="stage-column-stage-2"]');

    // Perform drag and drop
    await userCard.dragTo(targetStage);

    // Verify edit mode is activated
    await expect(page.locator('button:has-text("保存")')).toBeVisible();
    await expect(page.locator('button:has-text("キャンセル")')).toBeVisible();

    // Save changes
    await page.locator('button:has-text("保存")').click();

    // Verify success message
    await expect(page.locator('text=正常に更新されました')).toBeVisible();
  });

  test('should handle search functionality', async ({ page }) => {
    // Find search input
    const searchInput = page.locator('input[placeholder*="検索"]');

    // Search for specific user
    await searchInput.fill('田中');

    // Wait for search results
    await page.waitForTimeout(500); // Wait for debounce

    // Verify filtered results
    await expect(page.locator('text=田中太郎')).toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Verify all users are shown again
    await expect(page.locator('text=佐藤花子')).toBeVisible();
  });

  test('should handle stage collapse/expand', async ({ page }) => {
    // Find collapse button
    const collapseButton = page.locator('[data-testid="stage-column-stage-1"] button[aria-label*="折りたたみ"]');

    // Click to collapse
    await collapseButton.click();

    // Verify stage is collapsed
    const stageColumn = page.locator('[data-testid="stage-column-stage-1"]');
    await expect(stageColumn).toHaveClass(/collapsed/);

    // Click to expand
    await collapseButton.click();

    // Verify stage is expanded
    await expect(stageColumn).not.toHaveClass(/collapsed/);
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/v1/stage-management/users/stages', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });

    // Perform drag and drop
    const userCard = page.locator('[data-testid="user-card-user-1"]');
    const targetStage = page.locator('[data-testid="stage-column-stage-2"]');
    await userCard.dragTo(targetStage);

    // Try to save (should fail)
    await page.locator('button:has-text("保存")').click();

    // Verify error message is displayed
    await expect(page.locator('text=エラーが発生しました')).toBeVisible();

    // Verify still in edit mode
    await expect(page.locator('button:has-text("保存")')).toBeVisible();
  });

  test('should handle cancel operation', async ({ page }) => {
    // Perform drag and drop to enter edit mode
    const userCard = page.locator('[data-testid="user-card-user-1"]');
    const targetStage = page.locator('[data-testid="stage-column-stage-2"]');
    await userCard.dragTo(targetStage);

    // Verify edit mode
    await expect(page.locator('button:has-text("保存")')).toBeVisible();

    // Cancel changes
    await page.locator('button:has-text("キャンセル")').click();

    // Verify edit mode is exited
    await expect(page.locator('button:has-text("保存")')).not.toBeVisible();

    // Verify user is back in original position
    const originalStage = page.locator('[data-testid="stage-column-stage-1"]');
    await expect(originalStage.locator('text=田中太郎')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page loads correctly on mobile
    await expect(page.locator('h1')).toContainText('ステージ管理');

    // Verify stages are displayed in mobile layout
    await expect(page.locator('[data-testid="stage-column-stage-1"]')).toBeVisible();

    // Verify search functionality works on mobile
    const searchInput = page.locator('input[placeholder*="検索"]');
    await searchInput.fill('田中');
    await expect(page.locator('text=田中太郎')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');

    // Should focus on first interactive element
    await expect(page.locator(':focus')).toBeVisible();

    // Test keyboard shortcuts if implemented
    await page.keyboard.press('Escape');

    // Should exit any modal or edit mode
    await expect(page.locator('button:has-text("保存")')).not.toBeVisible();
  });
});