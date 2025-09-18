import { render, screen, fireEvent } from '@testing-library/react';
import { StageColumn } from '@/feature/stage-management/components/StageColumn';
import type { StageData } from '@/feature/stage-management/types';

// Mock @dnd-kit/core
jest.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    isOver: false,
    setNodeRef: jest.fn(),
  }),
}));

// Mock UserCard component
jest.mock('@/feature/stage-management/components/UserCard', () => ({
  UserCard: ({ user }: { user: any }) => (
    <div data-testid={`user-card-${user.id}`}>{user.name}</div>
  ),
}));

const mockStage: StageData = {
  id: 'stage-1',
  name: 'Stage 1',
  description: 'First evaluation stage',
  users: [
    {
      id: 'user-1',
      name: '田中太郎',
      code: 'EMP001',
      email: 'tanaka@example.com',
      department: { id: 'dept-1', name: '開発部', description: 'Dev' },
      role: { id: 'role-1', name: 'エンジニア', description: 'Engineer' },
    },
    {
      id: 'user-2',
      name: '佐藤花子',
      code: 'EMP002',
      email: 'sato@example.com',
      department: { id: 'dept-1', name: '開発部', description: 'Dev' },
      role: { id: 'role-1', name: 'エンジニア', description: 'Engineer' },
    },
  ],
};

describe('StageColumn', () => {
  const defaultProps = {
    stage: mockStage,
    isCollapsed: false,
    onToggleCollapse: jest.fn(),
    height: 320,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders stage information correctly', () => {
    render(<StageColumn {...defaultProps} />);

    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('First evaluation stage')).toBeInTheDocument();
    expect(screen.getByText('2名')).toBeInTheDocument();
  });

  it('renders all users in the stage', () => {
    render(<StageColumn {...defaultProps} />);

    expect(screen.getByTestId('user-card-user-1')).toBeInTheDocument();
    expect(screen.getByTestId('user-card-user-2')).toBeInTheDocument();
    expect(screen.getByText('田中太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
  });

  it('handles collapsed state correctly', () => {
    render(<StageColumn {...defaultProps} isCollapsed={true} height={140} />);

    const column = screen.getByTestId(`stage-column-${mockStage.id}`);
    expect(column).toHaveStyle({ height: '140px' });
  });

  it('calls onToggleCollapse when collapse button is clicked', () => {
    const onToggleCollapse = jest.fn();
    render(<StageColumn {...defaultProps} onToggleCollapse={onToggleCollapse} />);

    const collapseButton = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(collapseButton);

    expect(onToggleCollapse).toHaveBeenCalledWith('stage-1');
  });

  it('displays empty state when no users', () => {
    const emptyStage = { ...mockStage, users: [] };
    render(<StageColumn {...defaultProps} stage={emptyStage} />);

    expect(screen.getByText('0名')).toBeInTheDocument();
    expect(screen.getByText('ユーザーがいません')).toBeInTheDocument();
  });

  it('applies droppable styling when dragging over', () => {
    // Mock isOver state
    jest.mocked(require('@dnd-kit/core').useDroppable).mockReturnValue({
      isOver: true,
      setNodeRef: jest.fn(),
    });

    render(<StageColumn {...defaultProps} />);

    const dropZone = screen.getByTestId(`stage-column-${mockStage.id}`);
    expect(dropZone).toHaveClass('ring-2', 'ring-blue-500');
  });

  it('displays correct user count with proper Japanese formatting', () => {
    render(<StageColumn {...defaultProps} />);

    expect(screen.getByText('2名')).toBeInTheDocument();
  });

  it('handles long stage names gracefully', () => {
    const longNameStage = {
      ...mockStage,
      name: 'とても長いステージ名が設定された場合のテスト',
    };
    render(<StageColumn {...defaultProps} stage={longNameStage} />);

    expect(screen.getByText('とても長いステージ名が設定された場合のテスト')).toBeInTheDocument();
  });

  it('renders with proper accessibility attributes', () => {
    render(<StageColumn {...defaultProps} />);

    const column = screen.getByTestId(`stage-column-${mockStage.id}`);
    expect(column).toHaveAttribute('role', 'region');
    expect(column).toHaveAttribute('aria-label', expect.stringContaining('Stage 1'));
  });
});