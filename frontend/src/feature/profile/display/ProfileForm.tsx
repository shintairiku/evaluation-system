"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createUserAction } from '@/api/server-actions/users';
import type { Department, Stage, Role } from '@/api/types/user';
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

  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false);
  const supervisorDropdownRef = useRef<HTMLDivElement>(null);

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchTerm = supervisorSearch.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchTerm) ||
      user.employee_code.toLowerCase().includes(searchTerm) ||
      (user.job_title && user.job_title.toLowerCase().includes(searchTerm)) ||
      user.roles.some(role => role.name.toLowerCase().includes(searchTerm))
    );
  });

  // Get selected user info for display
  const selectedUser = users.find(user => user.id === formData.supervisor_id);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supervisorDropdownRef.current && !supervisorDropdownRef.current.contains(event.target as Node)) {
        setSupervisorDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSupervisorSelect = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      supervisor_id: userId
    }));
    setSupervisorDropdownOpen(false);
    setSupervisorSearch('');
  };

  const handleSupervisorSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSupervisorSearch(e.target.value);
    setSupervisorDropdownOpen(true);
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
            <Label htmlFor="supervisor_search">上司の選択（任意）</Label>
            <div className="relative" ref={supervisorDropdownRef}>
              {selectedUser ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                  <span className="text-sm">
                    {selectedUser.name} ({selectedUser.employee_code})
                    {selectedUser.job_title && ` - ${selectedUser.job_title}`}
                    {selectedUser.roles.length > 0 && (
                      <span className="text-gray-500 ml-2">
                        [{selectedUser.roles.map(role => role.description).join(', ')}]
                      </span>
                    )}
                  </span>
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
                <Input
                  id="supervisor_search"
                  type="text"
                  placeholder="上司を検索... (名前、社員番号、役職、または役割)"
                  value={supervisorSearch}
                  onChange={handleSupervisorSearchChange}
                  onFocus={() => setSupervisorDropdownOpen(true)}
                />
              )}
              
              {supervisorDropdownOpen && !selectedUser && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                        onClick={() => handleSupervisorSelect(user.id)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-sm text-gray-500">
                            社員番号: {user.employee_code}
                            {user.job_title && ` | 役職: ${user.job_title}`}
                          </span>
                          {user.roles.length > 0 && (
                            <span className="text-xs text-blue-600">
                              役割: {user.roles.map(role => role.description).join(', ')}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-500">
                      検索結果がありません
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              名前、社員番号、役職、または役割で検索できます。
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