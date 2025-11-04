"use client";

import { useState, useActionState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectRoles } from '@/components/ui/multi-select-roles';
import HierarchySetupWrapper from '../components/HierarchySetupWrapper';
import { createUserAction } from '@/api/server-actions/users';
import type { Department, Role, UserCreate } from '@/api/types/user';
import type { Stage } from '@/api/types/stage';
import type { UserProfileOption } from '@/api/types/user';

interface ProfileFormProps {
  departments: Department[];
  stages: Stage[];
  roles: Role[];
  users: UserProfileOption[];
}

export default function ProfileForm({ departments, stages, roles, users }: ProfileFormProps) {
  const { user } = useUser();
  const router = useRouter();

  // Filter out admin roles once
  const availableRoles = roles.filter(role => role.name.toLowerCase() !== 'admin');

  // Form state
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>([]);

  // Server action wrapper for useActionState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formActionWrapper = async (_prevState: any, formData: FormData) => {
    const userData: UserCreate = {
      clerk_user_id: formData.get('clerk_user_id') as string,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      employee_code: formData.get('employee_code') as string,
      job_title: formData.get('job_title') as string || undefined,
      department_id: formData.get('department_id') as string,
      stage_id: formData.get('stage_id') as string,
      role_ids: JSON.parse(formData.get('role_ids') as string || '[]'),
      supervisor_id: formData.get('supervisor_id') as string || undefined,
      subordinate_ids: JSON.parse(formData.get('subordinate_ids') as string || '[]')
    };
    
    return await createUserAction(userData);
  };

  const [actionState, formAction, isPending] = useActionState(formActionWrapper, null);

  // Handle action state changes
  useEffect(() => {
    if (actionState) {
      if (actionState.success && actionState.data) {
        toast.success('プロフィールが正常に作成されました！', {
          duration: 3000
        });
        router.push('/setup/confirmation');
      } else if (actionState.error) {
        toast.error(actionState.error, { duration: 4000 });
      }
    }
  }, [actionState, router]);

  const handleRoleSelectionChange = (selectedIds: number[]) => {
    const stringIds = selectedIds.map(index => {
      const role = availableRoles[index];
      return role ? role.id : '';
    }).filter(id => id !== '');

    setSelectedRoles(stringIds);

    if (stringIds.length > 0) {
      const selectedRoleLabels = selectedIds
        .map(index => availableRoles[index]?.description || availableRoles[index]?.name)
        .filter(Boolean)
        .join(', ');
      toast.success(`役職を選択しました: ${selectedRoleLabels}`, {
        duration: 1500
      });
    }
  };

  // Removed handleSupervisorSelect and selectedSupervisorUser - now handled by RoleBasedHierarchySelection

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール情報</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {/* Hidden fields for user data */}
          <input type="hidden" name="clerk_user_id" value={user?.id || ''} />
          <input type="hidden" name="name" value={
            user?.firstName && user?.lastName 
              ? `${user.lastName} ${user.firstName}` 
              : user?.fullName || ''
          } />
          <input type="hidden" name="email" value={user?.primaryEmailAddress?.emailAddress || ''} />
          <input type="hidden" name="department_id" value={selectedDepartment} />
          <input type="hidden" name="stage_id" value={selectedStage} />
          <input type="hidden" name="role_ids" value={JSON.stringify(selectedRoles)} />
          <input type="hidden" name="supervisor_id" value={selectedSupervisor} />
          <input type="hidden" name="subordinate_ids" value={JSON.stringify(selectedSubordinates)} />

          {actionState?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {actionState.error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">氏名</label>
              <Input 
                value={user?.firstName && user?.lastName 
                  ? `${user.lastName} ${user.firstName}` 
                  : user?.fullName || ''
                } 
                readOnly 
                className="bg-gray-100" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">メールアドレス</label>
              <Input 
                value={user?.primaryEmailAddress?.emailAddress || ''} 
                readOnly 
                className="bg-gray-100" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">社員番号 *</label>
            <Input 
              name="employee_code"
              placeholder="例: EMP001" 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">役職</label>
            <Input 
              name="job_title"
              placeholder="例: 営業部長" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">部署 *</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment} required>
              <SelectTrigger>
                <SelectValue placeholder="部署を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{dept.name}</span>
                      {dept.description && (
                        <span className="text-xs text-gray-500">{dept.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">段階 *</label>
            <Select value={selectedStage} onValueChange={setSelectedStage} required>
              <SelectTrigger>
                <SelectValue placeholder="段階を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">役職 *</label>
            <MultiSelectRoles
              roles={availableRoles.map((role, index) => ({
                id: index,
                name: role.name,
                description: role.description
              }))}
              selectedRoleIds={selectedRoles.map(roleId => {
                return availableRoles.findIndex(role => role.id === roleId);
              }).filter(index => index !== -1)}
              onSelectionChange={handleRoleSelectionChange}
              required={true}
            />
          </div>

          {/* Role-based Hierarchy Selection using existing HierarchyEditCard */}
          <HierarchySetupWrapper
            users={users}
            selectedRoles={selectedRoles}
            allRoles={roles}
            selectedSupervisor={selectedSupervisor}
            selectedSubordinates={selectedSubordinates}
            onSupervisorChange={setSelectedSupervisor}
            onSubordinatesChange={setSelectedSubordinates}
            disabled={isPending}
          />

          <Button
            type="submit"
            disabled={isPending || !selectedDepartment || !selectedStage || selectedRoles.length === 0}
            className="w-full"
          >
            {isPending ? 'プロフィールを作成中...' : 'プロフィールを作成'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
