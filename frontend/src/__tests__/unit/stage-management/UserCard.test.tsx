import { render, screen } from '@testing-library/react';
import { UserCard } from '@/feature/stage-management/components/UserCard';
import type { UserCardData } from '@/feature/stage-management/types';

// Mock @dnd-kit/core
jest.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: { onPointerDown: jest.fn() },
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
}));

const mockUser: UserCardData = {
  id: 'user-1',
  name: '田中太郎',
  code: 'EMP001',
  email: 'tanaka@example.com',
  avatarUrl: 'https://example.com/avatar.jpg',
  department: {
    id: 'dept-1',
    name: '開発部',
    description: 'Software Development',
  },
  role: {
    id: 'role-1',
    name: 'エンジニア',
    description: 'Software Engineer',
  },
};

describe('UserCard', () => {
  it('renders user information correctly', () => {
    render(<UserCard user={mockUser} stageId="stage-1" />);

    expect(screen.getByText('田中太郎')).toBeInTheDocument();
    expect(screen.getByText('EMP001')).toBeInTheDocument();
    expect(screen.getByText('tanaka@example.com')).toBeInTheDocument();
    expect(screen.getByText('開発部')).toBeInTheDocument();
    expect(screen.getByText('エンジニア')).toBeInTheDocument();
  });

  it('displays avatar with correct alt text', () => {
    render(<UserCard user={mockUser} stageId="stage-1" />);

    const avatar = screen.getByRole('img', { name: /田中太郎/i });
    expect(avatar).toBeInTheDocument();
  });

  it('renders draggable card structure', () => {
    render(<UserCard user={mockUser} stageId="stage-1" />);

    const card = screen.getByTestId(`user-card-${mockUser.id}`);
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('cursor-move');
  });

  it('handles user without avatar', () => {
    const userWithoutAvatar = { ...mockUser, avatarUrl: undefined };
    render(<UserCard user={userWithoutAvatar} stageId="stage-1" />);

    // Should show initials fallback
    expect(screen.getByText('田中')).toBeInTheDocument();
  });

  it('handles long user names gracefully', () => {
    const userWithLongName = {
      ...mockUser,
      name: 'とても長い名前の田中太郎さん',
    };
    render(<UserCard user={userWithLongName} stageId="stage-1" />);

    expect(screen.getByText('とても長い名前の田中太郎さん')).toBeInTheDocument();
  });

  it('displays department and role information', () => {
    render(<UserCard user={mockUser} stageId="stage-1" />);

    const departmentElement = screen.getByText('開発部');
    const roleElement = screen.getByText('エンジニア');

    expect(departmentElement).toBeInTheDocument();
    expect(roleElement).toBeInTheDocument();
  });
});