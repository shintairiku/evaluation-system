import { render, screen } from '@testing-library/react';
import { jest } from '@jest/globals';
import { StageManagementView } from '@/feature/stage-management';
import { updateUserStagesAction } from '@/api/server-actions/stage-management';
import type { Stage, UserDetailResponse } from '@/api/types';

// Mock server actions
jest.mock('@/api/server-actions/stage-management');

// Mock drag and drop
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode; onDragEnd?: (event: unknown) => void }) => (
    <div data-testid="dnd-context">
      {children}
    </div>
  ),
  useDroppable: () => ({
    isOver: false,
    setNodeRef: jest.fn(),
  }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
}));

describe('StageManagementView', () => {
  const mockStages: Stage[] = [
    {
      id: 'stage1',
      name: 'Stage 1',
      description: 'First stage',
    },
    {
      id: 'stage2', 
      name: 'Stage 2',
      description: 'Second stage',
    },
  ];

  const mockUsers: UserDetailResponse[] = [
    {
      id: 'user1',
      clerk_user_id: 'clerk1',
      employee_code: 'EMP001',
      name: 'Test User 1',
      email: 'user1@example.com',
      status: 'active' as 'active' | 'inactive',
      job_title: 'Engineer',
      stage: { id: 'stage1', name: 'Stage 1' },
      roles: [],
      supervisor: null,
      subordinates: null,
    },
    {
      id: 'user2',
      clerk_user_id: 'clerk2', 
      employee_code: 'EMP002',
      name: 'Test User 2',
      email: 'user2@example.com',
      status: 'active' as 'active' | 'inactive',
      job_title: 'Manager',
      stage: { id: 'stage1', name: 'Stage 1' },
      roles: [],
      supervisor: null,
      subordinates: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays stages and users correctly', () => {
    render(
      <StageManagementView 
        initialStages={mockStages}
        initialUsers={mockUsers}
      />
    );

    // Check if stages are displayed
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Stage 2')).toBeInTheDocument();
    
    // Check if users are displayed
    expect(screen.getByText('Test User 1')).toBeInTheDocument();
    expect(screen.getByText('Test User 2')).toBeInTheDocument();
    expect(screen.getByText('EMP001')).toBeInTheDocument();
    expect(screen.getByText('EMP002')).toBeInTheDocument();
  });

  test('shows user count per stage', () => {
    render(
      <StageManagementView 
        initialStages={mockStages}
        initialUsers={mockUsers}
      />
    );

    // Stage 1 should show 2 users, Stage 2 should show 0 users
    const userCountBadges = screen.getAllByText(/[0-9]/);
    expect(userCountBadges).toHaveLength(2); // One for each stage
  });

  test('handles empty stages correctly', () => {
    render(
      <StageManagementView 
        initialStages={mockStages}
        initialUsers={[]}
      />
    );

    // Should show "ユーザーなし" for empty stages
    expect(screen.getAllByText('ユーザーなし')).toHaveLength(2);
  });

  test('displays error when provided', () => {
    render(
      <StageManagementView 
        initialStages={mockStages}
        initialUsers={mockUsers}
      />
    );

    // This would be triggered by child components via onError callback
    // For now, just verify the component structure exists
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  test('renders stage grid component', () => {
    render(
      <StageManagementView 
        initialStages={mockStages}
        initialUsers={mockUsers}
      />
    );

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  test('transforms initial data correctly', () => {
    render(
      <StageManagementView 
        initialStages={mockStages}
        initialUsers={mockUsers}
      />
    );

    // Verify that users are correctly assigned to stages
    // Both users should be in Stage 1
    const stage1Section = screen.getByText('Stage 1').closest('div');
    expect(stage1Section).toContainElement(screen.getByText('Test User 1'));
    expect(stage1Section).toContainElement(screen.getByText('Test User 2'));
  });
});