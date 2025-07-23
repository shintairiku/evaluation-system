import type { UserDetailResponse } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, Building, Calendar, Clock } from 'lucide-react';

interface UserProfileCardProps {
  user: UserDetailResponse;
}

export default function UserProfileCard({ user }: UserProfileCardProps) {
  // Server Component - receives real user data from getUserByIdAction
  
  // Format dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card with Basic Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <Badge 
                  variant={user.status === 'active' ? 'default' : 
                          user.status === 'inactive' ? 'secondary' : 'outline'}
                >
                  {user.status === 'active' ? 'アクティブ' : 
                   user.status === 'inactive' ? '非アクティブ' : '承認待ち'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
              {user.job_title && (
                <div className="text-lg font-medium text-muted-foreground">
                  {user.job_title}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Department & Organization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="h-5 w-5" />
              <span>組織情報</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.department && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">部署</dt>
                <dd className="text-lg">{user.department.name}</dd>
                {user.department.description && (
                  <dd className="text-sm text-muted-foreground">{user.department.description}</dd>
                )}
              </div>
            )}
            
            {user.stage && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">職位</dt>
                <dd className="text-lg">{user.stage.name}</dd>
                {user.stage.description && (
                  <dd className="text-sm text-muted-foreground">{user.stage.description}</dd>
                )}
              </div>
            )}

            {user.roles && user.roles.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">役職</dt>
                <dd className="flex flex-wrap gap-2 mt-1">
                  {user.roles.map((role) => (
                    <Badge key={role.id} variant="outline">
                      {role.name}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>雇用情報</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">社員番号</dt>
              <dd className="text-lg font-mono">{user.employee_code}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-muted-foreground">作成日</dt>
              <dd className="text-lg">{formatDate((user as any).created_at)}</dd>
            </div>

            {(user as any).last_login_at && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">最終ログイン</dt>
                <dd className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate((user as any).last_login_at)}</span>
                </dd>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reporting Structure */}
      {(user.supervisor || (user.subordinates && user.subordinates.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>組織構造</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.supervisor && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">上司</dt>
                <dd className="flex items-center space-x-2 mt-1">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(user.supervisor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.supervisor.name}</div>
                    <div className="text-sm text-muted-foreground">{user.supervisor.email}</div>
                  </div>
                </dd>
              </div>
            )}

            {user.subordinates && user.subordinates.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  部下 ({user.subordinates.length}名)
                </dt>
                <dd className="space-y-2 mt-2">
                  {user.subordinates.map((subordinate) => (
                    <div key={subordinate.id} className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(subordinate.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{subordinate.name}</div>
                        <div className="text-sm text-muted-foreground">{subordinate.email}</div>
                      </div>
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}