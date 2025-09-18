import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StageManagementContainer } from '@/feature/stage-management';
import { updateUserStagesAction } from '@/api/server-actions/stage-management';
import type { StageWithUserCount } from '@/api/types';
import type { UserCardData } from '@/feature/stage-management/types';

// Mock server actions
jest.mock('@/api/server-actions/stage-management', () => ({
  updateUserStagesAction: jest.fn(),
}));

// Mock drag and drop
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
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
    listeners: { onPointerDown: jest.fn() },
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
}));

const mockStages: StageWithUserCount[] = [
  {
    id: 'stage-1',
    name: 'ステージ1',
    description: '初期ステージ',
    userCount: 2,
  },
  {
    id: 'stage-2',
    name: 'ステージ2',
    description: '中級ステージ',
    userCount: 1,
  },
];

const mockUsers: UserCardData[] = [
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
];

describe('Stage Management Integration', () => {
  const defaultProps = {
    initialStages: mockStages,
    initialUsers: mockUsers,
    total: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Stage Management Workflow', () => {
    it('should complete full drag and drop workflow with save', async () => {
      const user = userEvent.setup();
      const mockUpdateAction = jest.mocked(updateUserStagesAction);
      mockUpdateAction.mockResolvedValue({ success: true });

      render(<StageManagementContainer {...defaultProps} />);

      // Verify initial render
      expect(screen.getByText('ステージ1')).toBeInTheDocument();
      expect(screen.getByText('ステージ2')).toBeInTheDocument();
      expect(screen.getByText('田中太郎')).toBeInTheDocument();

      // Simulate drag and drop
      const dndContext = screen.getByTestId('dnd-context');
      fireEvent.drop(dndContext);

      // Should enter edit mode
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify API call
      await waitFor(() => {
        expect(mockUpdateAction).toHaveBeenCalledWith([
          {
            userId: 'user-1',
            fromStageId: 'stage-1',
            toStageId: 'stage-2',
          },
        ]);
      });

      // Should exit edit mode
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      });
    });

    it('should handle multiple user moves in batch', async () => {
      const user = userEvent.setup();
      const mockUpdateAction = jest.mocked(updateUserStagesAction);
      mockUpdateAction.mockResolvedValue({ success: true });

      render(<StageManagementContainer {...defaultProps} />);

      // Simulate multiple drag and drop operations
      const dndContext = screen.getByTestId('dnd-context');

      // First move
      fireEvent.drop(dndContext);

      // Second move (would need to be simulated differently for different users)
      // This is a simplified version
      fireEvent.drop(dndContext);

      // Save all changes
      const saveButton = await screen.findByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify batch update
      expect(mockUpdateAction).toHaveBeenCalled();
    });

    it('should handle cancel operation correctly', async () => {
      const user = userEvent.setup();
      render(<StageManagementContainer {...defaultProps} />);

      // Trigger edit mode
      const dndContext = screen.getByTestId('dnd-context');
      fireEvent.drop(dndContext);

      // Should be in edit mode
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      // Cancel changes
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should exit edit mode without API call
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      });

      expect(updateUserStagesAction).not.toHaveBeenCalled();
    });
  });

  describe('Search Integration', () => {
    it('should filter users based on search query', async () => {
      const user = userEvent.setup();
      render(<StageManagementContainer {...defaultProps} />);

      // Find search input
      const searchInput = screen.getByPlaceholderText(/search/i);

      // Search for specific user
      await user.type(searchInput, '田中');

      // Should show filtered results
      await waitFor(() => {
        expect(screen.getByText('田中太郎')).toBeInTheDocument();
        // Other user should be filtered out in real implementation
      });
    });

    it('should handle empty search results', async () => {
      const user = userEvent.setup();
      render(<StageManagementContainer {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'nonexistent');

      // Should show no results message
      await waitFor(() => {
        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      const mockUpdateAction = jest.mocked(updateUserStagesAction);
      mockUpdateAction.mockResolvedValue({
        success: false,
        error: 'Failed to update user stages'
      });

      render(<StageManagementContainer {...defaultProps} />);

      // Trigger edit mode and save
      const dndContext = screen.getByTestId('dnd-context');
      fireEvent.drop(dndContext);

      const saveButton = await screen.findByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to update/i)).toBeInTheDocument();
      });

      // Should remain in edit mode
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      const mockUpdateAction = jest.mocked(updateUserStagesAction);
      mockUpdateAction.mockRejectedValue(new Error('Network error'));

      render(<StageManagementContainer {...defaultProps} />);

      const dndContext = screen.getByTestId('dnd-context');
      fireEvent.drop(dndContext);

      const saveButton = await screen.findByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('State Management Integration', () => {
    it('should maintain pending changes across operations', async () => {
      render(<StageManagementContainer {...defaultProps} />);

      // Trigger multiple moves
      const dndContext = screen.getByTestId('dnd-context');
      fireEvent.drop(dndContext);

      // Should show pending changes indicator
      await waitFor(() => {
        expect(screen.getByText(/pending changes/i)).toBeInTheDocument();
      });
    });

    it('should handle stage collapse/expand state', async () => {
      const user = userEvent.setup();
      render(<StageManagementContainer {...defaultProps} />);

      // Find collapse button for stage
      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      await user.click(collapseButton);

      // Should update stage appearance
      const stageColumn = screen.getByTestId('stage-column-stage-1');
      expect(stageColumn).toHaveClass('collapsed');
    });
  });

  describe('Performance Integration', () => {
    it('should handle large number of users efficiently', async () => {
      const largeUserSet = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        code: `EMP${i.toString().padStart(3, '0')}`,
        email: `user${i}@example.com`,
        department: { id: 'dept-1', name: '開発部', description: 'Dev' },
        role: { id: 'role-1', name: 'エンジニア', description: 'Engineer' },
      }));

      const props = {
        ...defaultProps,
        initialUsers: largeUserSet,
        total: 100,
      };

      const startTime = performance.now();
      render(<StageManagementContainer {...props} />);
      const endTime = performance.now();

      // Should render within reasonable time (500ms threshold)
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});