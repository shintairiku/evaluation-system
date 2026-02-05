import { UserStatus } from '@/api/types';

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.PENDING_APPROVAL]: '承認待ち',
  [UserStatus.ACTIVE]: 'アクティブ',
  [UserStatus.INACTIVE]: '無効',
};

export function getGoalSubmissionRestriction(userStatus?: UserStatus): {
  title: string;
  description: string;
} | null {
  if (!userStatus || userStatus === UserStatus.ACTIVE) return null;

  const statusLabel = USER_STATUS_LABELS[userStatus] ?? userStatus;

  if (userStatus === UserStatus.PENDING_APPROVAL) {
    return {
      title: '目標を提出できません',
      description: `現在のステータスは「${statusLabel}」です。管理者がプロフィールを確認し、ステータスを「アクティブ」に変更するまで提出できません。`,
    };
  }

  if (userStatus === UserStatus.INACTIVE) {
    return {
      title: '目標を提出できません',
      description: `現在のステータスは「${statusLabel}」です。管理者にお問い合わせください。`,
    };
  }

  return {
    title: '目標を提出できません',
    description: `現在のステータスは「${statusLabel}」です。`,
  };
}

