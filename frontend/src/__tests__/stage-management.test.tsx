import React from 'react';
import { render, screen } from '@testing-library/react';
import StageManagementBoard from '@/feature/stage-management/display/StageManagementBoard';

const mockStages = [
  { id: 's1', name: 'Stage 1', userCount: 0 },
  { id: 's2', name: 'Stage 2', userCount: 0 },
];

const mockUsers = [
  {
    id: 'u1',
    clerk_user_id: 'ck_1',
    employee_code: 'E001',
    name: 'Alice',
    email: 'alice@example.com',
    status: 'active',
    roles: [],
    department: { id: 'd1', name: 'Dept' },
    stage: { id: 's1', name: 'Stage 1' } as any,
  } as any,
];

describe('StageManagementBoard', () => {
  test('renders stage titles and users', () => {
    render(<StageManagementBoard stages={mockStages as any} users={mockUsers as any} />);
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Stage 2')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
