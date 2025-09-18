import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetencyModal from '@/feature/competency-management/components/CompetencyModal';
import type { Competency, Stage } from '@/api/types';

// Mock the loading button component
jest.mock('@/components/ui/loading-states', () => ({
  LoadingButton: ({ children, loading, onClick, ...props }: any) => (
    <button onClick={onClick} disabled={loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

const mockCompetency: Competency = {
  id: 'comp-1',
  name: 'コミュニケーション能力',
  description: {
    basic: '基本的なコミュニケーションができる',
    intermediate: '効果的なコミュニケーションができる',
    advanced: 'リーダーシップを発揮したコミュニケーションができる',
  },
  stageId: 'stage-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockStages: Stage[] = [
  {
    id: 'stage-1',
    name: 'ステージ1',
    description: '初級ステージ',
  },
  {
    id: 'stage-2',
    name: 'ステージ2',
    description: '中級ステージ',
  },
];

describe('CompetencyModal', () => {
  const defaultProps = {
    competency: mockCompetency,
    stages: mockStages,
    isOpen: true,
    isAdmin: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    onDelete: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders competency information correctly', () => {
    render(<CompetencyModal {...defaultProps} />);

    expect(screen.getByDisplayValue('コミュニケーション能力')).toBeInTheDocument();
    expect(screen.getByDisplayValue('基本的なコミュニケーションができる')).toBeInTheDocument();
    expect(screen.getByDisplayValue('効果的なコミュニケーションができる')).toBeInTheDocument();
    expect(screen.getByDisplayValue('リーダーシップを発揮したコミュニケーションができる')).toBeInTheDocument();
  });

  it('displays stage selection correctly', () => {
    render(<CompetencyModal {...defaultProps} />);

    expect(screen.getByText('ステージ1')).toBeInTheDocument();
  });

  it('shows admin controls when user is admin', () => {
    render(<CompetencyModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('hides admin controls when user is not admin', () => {
    render(<CompetencyModal {...defaultProps} isAdmin={false} />);

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('makes inputs readonly when user is not admin', () => {
    render(<CompetencyModal {...defaultProps} isAdmin={false} />);

    const nameInput = screen.getByDisplayValue('コミュニケーション能力');
    expect(nameInput).toHaveAttribute('disabled');
  });

  it('calls onSave with correct data when save button is clicked', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(<CompetencyModal {...defaultProps} onSave={onSave} />);

    const nameInput = screen.getByDisplayValue('コミュニケーション能力');
    await user.clear(nameInput);
    await user.type(nameInput, '新しいコンピテンシー名');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      'comp-1',
      expect.objectContaining({
        name: '新しいコンピテンシー名',
        stageId: 'stage-1',
      })
    );
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(<CompetencyModal {...defaultProps} onDelete={onDelete} />);

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith('comp-1');
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<CompetencyModal {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state correctly', () => {
    render(<CompetencyModal {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Buttons should be disabled during loading
    const saveButton = screen.getByRole('button', { name: /Loading.../i });
    expect(saveButton).toBeDisabled();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(<CompetencyModal {...defaultProps} onSave={onSave} />);

    const nameInput = screen.getByDisplayValue('コミュニケーション能力');
    await user.clear(nameInput);

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('handles stage selection change', async () => {
    const user = userEvent.setup();
    render(<CompetencyModal {...defaultProps} />);

    // This would test stage selection change
    // Implementation depends on the Select component behavior
    const stageSelect = screen.getByRole('combobox');
    expect(stageSelect).toBeInTheDocument();
  });

  it('handles description level changes', async () => {
    const user = userEvent.setup();
    render(<CompetencyModal {...defaultProps} />);

    const basicDescription = screen.getByDisplayValue('基本的なコミュニケーションができる');
    await user.clear(basicDescription);
    await user.type(basicDescription, '新しい基本レベルの説明');

    expect(screen.getByDisplayValue('新しい基本レベルの説明')).toBeInTheDocument();
  });

  it('renders character counter for descriptions', () => {
    render(<CompetencyModal {...defaultProps} />);

    // Should show character counts for description fields
    const basicDescription = screen.getByDisplayValue('基本的なコミュニケーションができる');
    expect(basicDescription).toBeInTheDocument();

    // Character counter should be visible
    expect(screen.getByText(/文字/)).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    render(<CompetencyModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByDisplayValue('コミュニケーション能力')).not.toBeInTheDocument();
  });
});