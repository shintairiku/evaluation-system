import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  PermissionCatalogItem,
  PermissionGroup,
  RoleDetail,
  RolePermissionResponse,
} from '@/api/types';
import { RolePermissionMatrix } from '../RolePermissionMatrix';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const roles: RoleDetail[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Admin role',
    created_at: '2025-11-01T00:00:00.000Z',
    updated_at: '2025-11-01T00:00:00.000Z',
    permissions: [],
    user_count: 2,
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Viewer role',
    created_at: '2025-11-01T00:00:00.000Z',
    updated_at: '2025-11-01T00:00:00.000Z',
    permissions: [],
    user_count: 4,
  },
];

const catalog: PermissionCatalogItem[] = [
  {
    code: 'user:read',
    description: 'ユーザーを閲覧',
    permission_group: 'ユーザー',
  },
  {
    code: 'user:write',
    description: 'ユーザーを編集',
    permission_group: 'ユーザー',
  },
];

const groupedCatalog: PermissionGroup[] = [
  {
    permission_group: 'ユーザー',
    permissions: catalog,
  },
];

const assignments: RolePermissionResponse[] = [
  {
    roleId: 'role-admin',
    permissions: catalog,
    version: '1',
  },
  {
    roleId: 'role-viewer',
    permissions: [catalog[0]],
    version: '1',
  },
];

describe('RolePermissionMatrix card layout', () => {
  it('keeps controls and grid within the 権限マトリクス card', () => {
    render(
      <RolePermissionMatrix
        roles={roles}
        isAdmin
        initialAssignments={assignments}
        initialCatalog={catalog}
        initialGroupedCatalog={groupedCatalog}
        groupedCatalogWarning="テスト用のグループ警告"
        roleGuardError="テスト用のロールエラー"
      />,
    );

    const card = screen.getByTestId('role-permission-matrix-card');
    const searchInput = within(card).getByPlaceholderText('権限コードや説明で検索');
    expect(card).toContainElement(searchInput);

    const densityButton = within(card).getByRole('button', { name: '標準' });
    expect(card).toContainElement(densityButton);

    const matrixGrid = within(card).getByTestId('role-permission-matrix-grid');
    expect(card).toContainElement(matrixGrid);

    expect(within(card).getByText('権限グループを読み込めませんでした')).toBeInTheDocument();
    expect(within(card).getByText('権限情報の取得中に問題が発生しました')).toBeInTheDocument();
  });
});
