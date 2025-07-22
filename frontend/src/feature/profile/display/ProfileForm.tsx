"use client";

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectRoles } from '@/components/ui/multi-select-roles';
import { 
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { createUserAction } from '@/api/server-actions/users';
import type { Department, Stage, Role } from '@/api/types/user';
import type { UserProfileOption } from '@/api/types/user';
import { useLoading } from '@/hooks/useLoading';

interface ProfileFormProps {
  departments: Department[];
  stages: Stage[];
  roles: Role[];
  users: UserProfileOption[];
}

export default function ProfileForm({ departments, stages, roles, users }: ProfileFormProps) {
  const { user } = useUser();
  const router = useRouter();
  const { isLoading, withLoading } = useLoading('profile-creation');
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    employee_code: '',
    job_title: '',
    department_id: '',
    stage_id: '',
    role_ids: [] as number[],
    supervisor_id: ''
  });

  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false);

  // Get available users for supervisor selection (excluding current user if editing)
  const availableUsers = users;

  // Get selected user info for display
  const selectedUser = users.find(user => user.id === formData.supervisor_id);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (field: string) => (value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRoleSelectionChange = (selectedIds: number[]) => {
    setFormData(prev => ({
      ...prev,
      role_ids: selectedIds
    }));
  };

  const handleSupervisorSelect = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      supervisor_id: userId
    }));
    setSupervisorPopoverOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('ユーザー情報を取得できませんでした。');
      return;
    }

    if (!formData.employee_code || !formData.department_id || !formData.stage_id) {
      setError('必須項目をすべて入力してください。');
      return;
    }

    if (formData.role_ids.length === 0) {
      setError('少なくとも1つの役割を選択してください。');
      return;
    }

    await withLoading(async () => {
      setError(null);

      try {
        // Get name from Clerk user data
        const fullName = user.firstName && user.lastName 
          ? `${user.lastName} ${user.firstName}` // Japanese style: surname first
          : user.fullName || "";

        const signupData = {
          clerk_user_id: user.id,
          name: fullName,
          email: user.primaryEmailAddress?.emailAddress || '',
          employee_code: formData.employee_code,
          job_title: formData.job_title || undefined,
          department_id: formData.department_id,
          stage_id: formData.stage_id,
          role_ids: formData.role_ids, // Use selected roles from form
          supervisor_id: formData.supervisor_id || undefined,
          subordinate_ids: [] // Default empty array for signup
        };

        const result = await createUserAction(signupData);

        if (result.success) {
          // Update Clerk metadata to indicate profile completion
          await user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              profileCompleted: true,
              status: 'pending_approval'
            }
          });
          
          router.push('/profile/confirmation');
        } else {
          setError(result.error || 'プロフィールの作成に失敗しました。');
          throw new Error(result.error || 'Profile creation failed');
        }
      } catch (error) {
        console.error('Profile creation error:', error);
        const errorMessage = '予期しないエラーが発生しました。もう一度お試しください。';
        setError(errorMessage);
        throw error; // Re-throw to let withLoading handle it
      }
    }, {
      onError: (error) => {
        console.error('Profile creation loading error:', error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール情報</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="employee_code">社員番号 *</Label>
            <Input
              id="employee_code"
              name="employee_code"
              type="text"
              value={formData.employee_code}
              onChange={handleInputChange}
              required
              placeholder="例: EMP001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_title">役職</Label>
            <Input
              id="job_title"
              name="job_title"
              type="text"
              value={formData.job_title}
              onChange={handleInputChange}
              placeholder="例: 営業部長"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department_id">部署 *</Label>
            <Select value={formData.department_id} onValueChange={handleSelectChange('department_id')} required>
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

          <div className="space-y-2">
            <Label htmlFor="stage_id">段階 *</Label>
            <Select value={formData.stage_id} onValueChange={handleSelectChange('stage_id')} required>
              <SelectTrigger>
                <SelectValue placeholder="段階を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{stage.name}</span>
                      {stage.description && (
                        <span className="text-xs text-gray-500">{stage.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <MultiSelectRoles
            roles={roles}
            selectedRoleIds={formData.role_ids}
            onSelectionChange={handleRoleSelectionChange}
            required={true}
          />

          <div className="space-y-2">
            <Label>上司の選択（任意）</Label>
            
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                <div className="flex flex-col">
                  <span className="font-medium">{selectedUser.name}</span>
                  <span className="text-sm text-gray-500">
                    社員番号: {selectedUser.employee_code}
                    {selectedUser.job_title && ` | 役職: ${selectedUser.job_title}`}
                  </span>
                  {selectedUser.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedUser.roles.map(role => (
                        <Badge key={role.id} variant="secondary" className="text-xs">
                          {role.description}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, supervisor_id: '' }))}
                >
                  ×
                </Button>
              </div>
            ) : (
              <Popover open={supervisorPopoverOpen} onOpenChange={setSupervisorPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    上司を選択してください...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="名前、社員番号、役職で検索..." />
                    <CommandList>
                      <CommandEmpty>検索結果がありません</CommandEmpty>
                      <CommandGroup>
                        {availableUsers.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.name} ${user.employee_code} ${user.job_title || ''} ${user.roles.map(r => r.name).join(' ')}`}
                            onSelect={() => handleSupervisorSelect(user.id)}
                          >
                            <div className="flex flex-col w-full">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-sm text-gray-500">
                                社員番号: {user.employee_code}
                                {user.job_title && ` | 役職: ${user.job_title}`}
                              </span>
                              {user.roles.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {user.roles.map(role => (
                                    <Badge key={role.id} variant="outline" className="text-xs">
                                      {role.description}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            
            <p className="text-sm text-gray-500">
              名前、社員番号、役職、または役割で検索できます。
            </p>
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="プロフィールを作成中..."
            className="w-full"
          >
            プロフィールを作成
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  );
} 