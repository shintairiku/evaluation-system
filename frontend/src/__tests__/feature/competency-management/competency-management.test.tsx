import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { CompetencyManagementView } from '@/feature/competency-management';
import { CompetencyModal } from '@/feature/competency-management';
import type { Competency, Stage, PaginatedResponse } from '@/api/types';

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock server actions
vi.mock('@/api/server-actions/competencies', () => ({
  updateCompetencyAction: vi.fn(),
  deleteCompetencyAction: vi.fn(),
}));

const mockStages: Stage[] = [
  {
    id: 'stage-1',
    name: 'S1',
    description: 'Junior level stage',
  },
  {
    id: 'stage-2',
    name: 'S2',
    description: 'Mid level stage',
  },
];

const mockCompetencies: Competency[] = [
  {
    id: 'comp-1',
    name: 'Problem Solving',
    description: {
      '1': 'Basic problem identification',
      '2': 'Systematic problem analysis',
      '3': 'Advanced solution development',
    },
    stageId: 'stage-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'comp-2',
    name: 'Communication',
    description: {
      '1': 'Clear verbal communication',
      '2': 'Effective written communication',
    },
    stageId: 'stage-2',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockPaginatedCompetencies: PaginatedResponse<Competency> = {
  items: mockCompetencies,
  total: 2,
  page: 1,
  limit: 10,
  pages: 1,
};

describe('CompetencyManagementView', () => {
  const defaultProps = {
    initialCompetencies: mockPaginatedCompetencies,
    stages: mockStages,
    isAdmin: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders competency management view correctly', () => {
    render(<CompetencyManagementView {...defaultProps} />);

    expect(screen.getByText('コンピテンシー管理')).toBeInTheDocument();
    expect(screen.getByText('ステージ別のコンピテンシー項目を管理できます')).toBeInTheDocument();
  });

  it('displays competencies grouped by stage', () => {
    render(<CompetencyManagementView {...defaultProps} />);

    // Check stage headers
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();

    // Check competencies
    expect(screen.getByText('Problem Solving')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('filters competencies by search term', async () => {
    render(<CompetencyManagementView {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('コンピテンシーを検索...');
    fireEvent.change(searchInput, { target: { value: 'Problem' } });

    await waitFor(() => {
      expect(screen.getByText('Problem Solving')).toBeInTheDocument();
      expect(screen.queryByText('Communication')).not.toBeInTheDocument();
    });
  });

  it('filters competencies by stage', async () => {
    render(<CompetencyManagementView {...defaultProps} />);

    const stageFilter = screen.getByRole('combobox');
    fireEvent.click(stageFilter);

    const s1Option = screen.getByText('S1');
    fireEvent.click(s1Option);

    await waitFor(() => {
      expect(screen.getByText('Problem Solving')).toBeInTheDocument();
      expect(screen.queryByText('Communication')).not.toBeInTheDocument();
    });
  });

  it('opens modal when competency is clicked', async () => {
    render(<CompetencyManagementView {...defaultProps} />);

    const competencyCard = screen.getByText('Problem Solving').closest('div[role="button"], .cursor-pointer') || screen.getByText('Problem Solving');
    fireEvent.click(competencyCard);

    await waitFor(() => {
      expect(screen.getByText('コンピテンシー編集')).toBeInTheDocument();
    });
  });

  it('shows viewer mode for non-admin users', () => {
    render(<CompetencyManagementView {...defaultProps} isAdmin={false} />);

    expect(screen.getByText('ステージ別のコンピテンシー項目を確認できます')).toBeInTheDocument();
  });
});

describe('CompetencyModal', () => {
  const defaultProps = {
    competency: mockCompetencies[0],
    stages: mockStages,
    isOpen: true,
    isAdmin: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with competency details', () => {
    render(<CompetencyModal {...defaultProps} />);

    expect(screen.getByText('コンピテンシー編集')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Problem Solving')).toBeInTheDocument();
  });

  it('displays competency descriptions', () => {
    render(<CompetencyModal {...defaultProps} />);

    expect(screen.getByDisplayValue('Basic problem identification')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Systematic problem analysis')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Advanced solution development')).toBeInTheDocument();
  });

  it('allows editing competency name and descriptions for admin', () => {
    render(<CompetencyModal {...defaultProps} />);

    const nameInput = screen.getByDisplayValue('Problem Solving');
    fireEvent.change(nameInput, { target: { value: 'Updated Problem Solving' } });

    expect(screen.getByDisplayValue('Updated Problem Solving')).toBeInTheDocument();
  });

  it('disables editing for non-admin users', () => {
    render(<CompetencyModal {...defaultProps} isAdmin={false} />);

    expect(screen.getByText('コンピテンシー詳細')).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Problem Solving');
    expect(nameInput).toBeDisabled();
  });

  it('calls onSave when save button is clicked', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    render(<CompetencyModal {...defaultProps} onSave={mockOnSave} />);

    const saveButton = screen.getByText('保存');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('comp-1', {
        name: 'Problem Solving',
        description: {
          '1': 'Basic problem identification',
          '2': 'Systematic problem analysis',
          '3': 'Advanced solution development',
        },
        stageId: 'stage-1',
      });
    });
  });

  it('shows delete confirmation dialog', async () => {
    render(<CompetencyModal {...defaultProps} />);

    const deleteButton = screen.getByRole('button', { name: '' }); // Trash icon button
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('コンピテンシーを削除しますか？')).toBeInTheDocument();
    });
  });

  it('calls onDelete when delete is confirmed', async () => {
    const mockOnDelete = vi.fn().mockResolvedValue(undefined);
    render(<CompetencyModal {...defaultProps} onDelete={mockOnDelete} />);

    // Open delete dialog
    const deleteButton = screen.getByRole('button', { name: '' }); // Trash icon button
    fireEvent.click(deleteButton);

    await waitFor(() => {
      const confirmButton = screen.getByText('削除');
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith('comp-1');
    });
  });

  it('validates required fields', () => {
    render(<CompetencyModal {...defaultProps} />);

    const nameInput = screen.getByDisplayValue('Problem Solving');
    fireEvent.change(nameInput, { target: { value: '' } });

    const saveButton = screen.getByText('保存');
    expect(saveButton).toBeDisabled();
  });

  it('handles loading state', () => {
    render(<CompetencyModal {...defaultProps} isLoading={true} />);

    expect(screen.getByText('保存中...')).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Problem Solving');
    expect(nameInput).toBeDisabled();
  });
});