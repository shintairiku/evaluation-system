import type { RoleDetail } from '@/api/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PermissionsTabProps {
  roles: RoleDetail[];
}

export function PermissionsTab({ roles }: PermissionsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">権限テンプレート（プレビュー）</CardTitle>
          <p className="text-xs text-muted-foreground">
            権限タブから各ロールの権限を確認できます。編集機能はこのあと追加されます。
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {role.permissions?.length ?? 0} permissions
                  </Badge>
                </div>
                {role.permissions && role.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((permission) => (
                      <Badge key={permission.name} variant="outline" className="text-xs uppercase tracking-wide">
                        {permission.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">権限データが設定されていません。</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
