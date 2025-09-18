import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { StageGrid } from '@/feature/stage-management';
import { updateUserStagesAction } from '@/api/server-actions/stage-management';
import type { StageData } from '@/feature/stage-management';

// Mock server actions
jest.mock('@/api/server-actions/stage-management');
const mockUpdateUserStagesAction = updateUserStagesAction as jest.MockedFunction<typeof updateUserStagesAction>;

// Mock drag and drop
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd, onDragStart }: { children: React.ReactNode; onDragEnd?: (event: unknown) => void; onDragStart?: (event: unknown) => void }) => (
    <div 
      data-testid="dnd-context" 
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd?.({ 
          active: { id: 'user1', data: { current: { user: { id: 'user1' }, stageId: 'stage1' } } }, 
          over: { id: 'stage2' } 
        });
      }}
      onDragStart={() => onDragStart?.({ active: { id: 'user1' } })}
    >
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

describe('StageGrid', () => {
  const mockStages: StageData[] = [
    {
      id: 'stage1',
      name: 'Stage 1',
      description: 'First stage',
      users: [
        {
          id: 'user1',
          name: 'Test User 1',
          employee_code: 'EMP001',
          job_title: 'Engineer',
          email: 'user1@example.com',
          current_stage_id: 'stage1',
        },
      ],
    },
    {
      id: 'stage2',
      name: 'Stage 2', 
      description: 'Second stage',
      users: [],
    },
  ];

  const mockOnError = jest.fn();
  const mockOnClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUserStagesAction.mockResolvedValue({ success: true });
  });

  test('renders all stages correctly', () => {
    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Stage 2')).toBeInTheDocument();
    expect(screen.getByText('Test User 1')).toBeInTheDocument();
  });

  test('enables edit mode on drag and drop', async () => {
    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    // Simulate drag and drop
    const dndContext = screen.getByTestId('dnd-context');
    fireEvent.drop(dndContext);

    // Should enable edit mode and show controls
    await waitFor(() => {
      expect(screen.getByText('編集モード')).toBeInTheDocument();
      expect(screen.getByText('1件の変更')).toBeInTheDocument();
    });
  });

  test('shows save and cancel buttons in edit mode', async () => {
    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    // Trigger edit mode
    const dndContext = screen.getByTestId('dnd-context');
    fireEvent.drop(dndContext);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /キャンセル/ })).toBeInTheDocument();
    });
  });

  test('saves changes when save button is clicked', async () => {
    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    // Trigger edit mode
    const dndContext = screen.getByTestId('dnd-context');
    fireEvent.drop(dndContext);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /保存/ });
      fireEvent.click(saveButton);
    });

    // Should call server action
    await waitFor(() => {
      expect(mockUpdateUserStagesAction).toHaveBeenCalledWith([
        {
          userId: 'user1',
          fromStageId: 'stage1',
          toStageId: 'stage2',
        },
      ]);
    });
  });

  test('cancels changes when cancel button is clicked', async () => {
    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    // Trigger edit mode
    const dndContext = screen.getByTestId('dnd-context');
    fireEvent.drop(dndContext);

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
      fireEvent.click(cancelButton);
    });

    // Edit mode should be disabled
    await waitFor(() => {
      expect(screen.queryByText('編集モード')).not.toBeInTheDocument();
    });
  });

  test('handles server action errors', async () => {
    mockUpdateUserStagesAction.mockResolvedValue({ 
      success: false, 
      error: 'Test error' 
    });

    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    // Trigger edit mode and save
    const dndContext = screen.getByTestId('dnd-context');
    fireEvent.drop(dndContext);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /保存/ });
      fireEvent.click(saveButton);
    });

    // Should call onError
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Test error');
    });
  });

  test('shows loading state during save', async () => {
    // Mock delayed response
    mockUpdateUserStagesAction.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );

    render(
      <StageGrid
        initialStages={mockStages}
        onError={mockOnError}
        onClearError={mockOnClearError}
      />
    );

    // Trigger edit mode and save
    const dndContext = screen.getByTestId('dnd-context');
    fireEvent.drop(dndContext);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /保存/ });
      fireEvent.click(saveButton);
    });

    // Should show loading state
    expect(screen.getByText('保存中...')).toBeInTheDocument();
  });
});