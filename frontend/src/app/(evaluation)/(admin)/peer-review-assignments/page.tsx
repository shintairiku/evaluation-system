import { PeerReviewAssignmentsPage } from '@/feature/evaluation/admin/peer-review-assignments';

export const metadata = {
  title: '評価者割当管理 | 管理者',
  description: '同僚評価者の割当を管理',
};

export default function Page() {
  return <PeerReviewAssignmentsPage />;
}
