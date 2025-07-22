"use client";

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { profileFormSchema, type ProfileFormData } from '@/lib/validation/user';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

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
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false);

  // Initialize react-hook-form with Zod validation
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      employee_code: '',
      job_title: '',
      department_id: '',
      stage_id: '',
      role_ids: [],
      supervisor_id: '',
    },
  });

  // Get available users for supervisor selection (excluding current user if editing)
  const availableUsers = users;

  // Get selected user info for display
  const selectedUser = users.find(u => u.id === form.watch('supervisor_id'));


  const handleRoleSelectionChange = (selectedIds: number[]) => {
    // Convert number indices back to string UUIDs
    const stringIds = selectedIds.map(index => {
      const role = roles[index];
      return role ? role.id : '';
    }).filter(id => id !== '');
    
    form.setValue('role_ids', stringIds, { shouldValidate: true });
  };

  const handleSupervisorSelect = (userId: string) => {
    form.setValue('supervisor_id', userId, { shouldValidate: true });
    setSupervisorPopoverOpen(false);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      setError('ユーザー情報を取得できませんでした。');
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
          employee_code: data.employee_code,
          job_title: data.job_title || undefined,
          department_id: data.department_id,
          stage_id: data.stage_id,
          role_ids: data.role_ids,
          supervisor_id: data.supervisor_id || undefined,
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="employee_code"
              render={({ field }: { field: ControllerRenderProps<ProfileFormData, 'employee_code'> }) => (
                <FormItem>
                  <FormLabel>社員番号 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例: EMP001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="job_title"
              render={({ field }: { field: ControllerRenderProps<ProfileFormData, 'job_title'> }) => (
                <FormItem>
                  <FormLabel>役職</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 営業部長" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department_id"
              render={({ field }: { field: ControllerRenderProps<ProfileFormData, 'department_id'> }) => (
                <FormItem>
                  <FormLabel>部署 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="部署を選択してください" />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage_id"
              render={({ field }: { field: ControllerRenderProps<ProfileFormData, 'stage_id'> }) => (
                <FormItem>
                  <FormLabel>段階 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="段階を選択してください" />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role_ids"
              render={({ field }: { field: ControllerRenderProps<ProfileFormData, 'role_ids'> }) => (
                <FormItem>
                  <FormLabel>役職 *</FormLabel>
                  <FormControl>
                    <MultiSelectRoles
                      roles={roles.map((role, index) => ({
                        id: index,
                        name: role.name,
                        description: role.description
                      }))}
                      selectedRoleIds={field.value.map(roleId => {
                        return roles.findIndex(role => role.id === roleId);
                      }).filter(index => index !== -1)}
                      onSelectionChange={handleRoleSelectionChange}
                      required={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supervisor_id"
              render={({ field }: { field: ControllerRenderProps<ProfileFormData, 'supervisor_id'> }) => (
                <FormItem>
                  <FormLabel>上司の選択（任意）</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
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
                            onClick={() => form.setValue('supervisor_id', '', { shouldValidate: true })}
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
                    </div>
                  </FormControl>
                  <FormDescription>
                    名前、社員番号、役職、または役割で検索できます。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingText="プロフィールを作成中..."
              className="w-full"
            >
              プロフィールを作成
            </LoadingButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
} 