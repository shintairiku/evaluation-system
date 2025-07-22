"use client";

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
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

  
  // Track form field states for optimistic feedback
  const [fieldStates, setFieldStates] = useState<Record<string, 'valid' | 'invalid' | 'pending'>>({});
  
  // Handle optimistic field validation
  const handleFieldChange = (fieldName: keyof ProfileFormData) => {
    // Update field state optimistically
    setFieldStates(prev => ({ ...prev, [fieldName]: 'pending' }));
    
    // Validate field with a slight delay for better UX
    setTimeout(() => {
      const errors = form.formState.errors;
      const hasError = errors[fieldName];
      
      setFieldStates(prev => ({ 
        ...prev, 
        [fieldName]: hasError ? 'invalid' : 'valid' 
      }));
      
      // Show success feedback for valid required fields
      if (!hasError && ['employee_code', 'department_id', 'stage_id', 'role_ids'].includes(fieldName)) {
        const fieldLabels = {
          employee_code: '社員番号',
          department_id: '部署',
          stage_id: 'ステージ',
          role_ids: '役職'
        };
        
        toast.success(`${fieldLabels[fieldName as keyof typeof fieldLabels]}を確認しました`, {
          duration: 1000
        });
      }
    }, 300);
  };

  // Initialize react-hook-form with Zod validation
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onChange', // Enable real-time validation
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
    
    // Optimistic update with immediate visual feedback
    form.setValue('role_ids', stringIds, { shouldValidate: true });
    
    // Show immediate feedback for role selection
    if (stringIds.length > 0) {
      const selectedRoleNames = selectedIds
        .map(index => roles[index]?.name)
        .filter(Boolean)
        .join(', ');
      toast.success(`役職を選択しました: ${selectedRoleNames}`, { 
        duration: 1500
      });
    }
  };

  const handleSupervisorSelect = (userId: string) => {
    form.setValue('supervisor_id', userId, { shouldValidate: true });
    setSupervisorPopoverOpen(false);
    
    // Show immediate feedback for supervisor selection
    const selectedUser = users.find(u => u.id === userId);
    if (selectedUser) {
      toast.success(`上司を選択しました: ${selectedUser.name}`, {
        duration: 1500
      });
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      setError('ユーザー情報を取得できませんでした。');
      return;
    }

    // Show immediate optimistic success and navigate
    toast.success('プロフィールを作成しています...', {
      duration: 2000
    });

    // Navigate optimistically for better UX
    const optimisticNavigation = setTimeout(() => {
      router.push('/profile/confirmation');
    }, 500);

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
          
          // Clear the optimistic navigation timeout since we're successful
          clearTimeout(optimisticNavigation);
          
          toast.success('プロフィールが正常に作成されました！', {
            duration: 3000
          });
          
          // Navigate to confirmation (might already be there from optimistic nav)
          router.push('/profile/confirmation');
        } else {
          // Clear optimistic navigation and show error
          clearTimeout(optimisticNavigation);
          
          const errorMsg = result.error || 'プロフィールの作成に失敗しました。';
          setError(errorMsg);
          toast.error(errorMsg, { duration: 4000 });
          
          throw new Error(result.error || 'Profile creation failed');
        }
      } catch (error) {
        console.error('Profile creation error:', error);
        
        // Clear optimistic navigation on error
        clearTimeout(optimisticNavigation);
        
        const errorMessage = '予期しないエラーが発生しました。もう一度お試しください。';
        setError(errorMessage);
        toast.error(errorMessage, { duration: 4000 });
        
        throw error; // Re-throw to let withLoading handle it
      }
    }, {
      onError: (error) => {
        console.error('Profile creation loading error:', error);
        clearTimeout(optimisticNavigation);
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
                  <FormLabel>
                    社員番号 *
                    {fieldStates.employee_code === 'valid' && (
                      <span className="ml-2 text-green-600 text-sm">✓</span>
                    )}
                    {fieldStates.employee_code === 'pending' && (
                      <span className="ml-2 text-yellow-600 text-sm">⏳</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="例: EMP001" 
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleFieldChange('employee_code');
                      }}
                      className={
                        fieldStates.employee_code === 'valid' 
                          ? 'border-green-500 focus:border-green-600' 
                          : fieldStates.employee_code === 'invalid'
                          ? 'border-red-500 focus:border-red-600'
                          : ''
                      }
                    />
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
                  <FormLabel>
                    部署 *
                    {fieldStates.department_id === 'valid' && (
                      <span className="ml-2 text-green-600 text-sm">✓</span>
                    )}
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleFieldChange('department_id');
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={
                          fieldStates.department_id === 'valid' 
                            ? 'border-green-500 focus:border-green-600' 
                            : fieldStates.department_id === 'invalid'
                            ? 'border-red-500 focus:border-red-600'
                            : ''
                        }
                      >
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
                  <FormLabel>
                    段階 *
                    {fieldStates.stage_id === 'valid' && (
                      <span className="ml-2 text-green-600 text-sm">✓</span>
                    )}
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleFieldChange('stage_id');
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={
                          fieldStates.stage_id === 'valid' 
                            ? 'border-green-500 focus:border-green-600' 
                            : fieldStates.stage_id === 'invalid'
                            ? 'border-red-500 focus:border-red-600'
                            : ''
                        }
                      >
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
                  <FormLabel>
                    役職 *
                    {fieldStates.role_ids === 'valid' && (
                      <span className="ml-2 text-green-600 text-sm">✓</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <div className={
                      fieldStates.role_ids === 'valid' 
                        ? 'ring-2 ring-green-500 rounded-md' 
                        : fieldStates.role_ids === 'invalid'
                        ? 'ring-2 ring-red-500 rounded-md'
                        : ''
                    }>
                      <MultiSelectRoles
                        roles={roles.map((role, index) => ({
                          id: index,
                          name: role.name,
                          description: role.description
                        }))}
                        selectedRoleIds={field.value.map(roleId => {
                          return roles.findIndex(role => role.id === roleId);
                        }).filter(index => index !== -1)}
                        onSelectionChange={(selectedIds) => {
                          handleRoleSelectionChange(selectedIds);
                          handleFieldChange('role_ids');
                        }}
                        required={true}
                      />
                    </div>
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