"use client";

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signupAction } from '@/api/server-actions/auth';
import type { Department, Stage, Role } from '@/api/types/user';
import type { UserProfileOption } from '@/api/types/auth';

interface ProfileFormProps {
  departments: Department[];
  stages: Stage[];
  roles: Role[];
  users: UserProfileOption[];
}

export default function ProfileForm({ departments, stages, roles, users }: ProfileFormProps) {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    employee_code: '',
    job_title: '',
    department_id: '',
    stage_id: '',
    role_ids: [] as number[],
    supervisor_id: ''
  });

  // Separate users by role
  const supervisors = users.filter(user => 
    user.roles.some(role => role.name === 'supervisor' || role.name === 'admin')
  );
  const employees = users.filter(user => 
    user.roles.some(role => role.name === 'employee') && 
    !user.roles.some(role => role.name === 'supervisor' || role.name === 'admin')
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({
      ...prev,
      role_ids: selectedOptions
    }));
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

    setLoading(true);
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
        supervisor_id: formData.supervisor_id || undefined
      };

      const result = await signupAction(signupData);

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
      }
    } catch (error) {
      console.error('Profile creation error:', error);
      setError('予期しないエラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
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
            <Select
              id="department_id"
              name="department_id"
              value={formData.department_id}
              onChange={handleInputChange}
              required
            >
              <option value="">部署を選択してください</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage_id">段階 *</Label>
            <Select
              id="stage_id"
              name="stage_id"
              value={formData.stage_id}
              onChange={handleInputChange}
              required
            >
              <option value="">段階を選択してください</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role_ids">役割 *</Label>
            <Select
              id="role_ids"
              name="role_ids"
              multiple
              value={formData.role_ids.map(String)}
              onChange={handleRoleChange}
              required
              className="min-h-[100px]"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </option>
              ))}
            </Select>
            <p className="text-sm text-gray-500">
              複数選択可能です。Ctrl/Cmd キーを押しながらクリックしてください。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supervisor_id">上司の選択（任意）</Label>
            <Select
              id="supervisor_id"
              name="supervisor_id"
              value={formData.supervisor_id}
              onChange={handleInputChange}
            >
              <option value="">上司を選択してください</option>
              
              {supervisors.length > 0 && (
                <optgroup label="管理職・スーパーバイザー">
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} ({supervisor.employee_code}) - {supervisor.job_title || '役職なし'}
                    </option>
                  ))}
                </optgroup>
              )}
              
              {employees.length > 0 && (
                <optgroup label="一般社員">
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employee_code}) - {employee.job_title || '役職なし'}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
            <p className="text-sm text-gray-500">
              通常は管理職・スーパーバイザーから選択してください。
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? '処理中...' : 'プロフィールを作成'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 