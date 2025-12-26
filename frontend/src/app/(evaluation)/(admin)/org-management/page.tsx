import { Metadata } from 'next';
import OrgManagementRoute from '@/feature/org-management/OrgManagementRoute';

export const metadata: Metadata = {
  title: '組織管理 | 人事評価システム',
  description: 'ユーザー・部門・ロールを一元管理し、ステータスを一括更新します',
};

export default async function OrgManagementPage() {
  return <OrgManagementRoute />;
}
