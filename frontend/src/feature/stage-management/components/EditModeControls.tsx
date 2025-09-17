'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, X, AlertCircle } from 'lucide-react';

interface EditModeControlsProps {
  pendingChangesCount: number;
  onSave: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Edit Mode Controls Component
 * 
 * Implements the EditModeControls specified in .kiro design.md:
 * EditModeControls (保存/キャンセル)
 * 
 * Shows save/cancel buttons and pending changes count
 * Appears only when there are pending changes (requirement 1.5)
 */
export default function EditModeControls({
  pendingChangesCount,
  onSave,
  onCancel,
  isLoading = false
}: EditModeControlsProps) {
  return (
    <Card className="border-orange-300 bg-orange-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-orange-900">
                編集モード
              </span>
            </div>
            
            <Badge variant="secondary" className="bg-orange-200 text-orange-800">
              {pendingChangesCount}件の変更
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isLoading}
              className="border-gray-300"
            >
              <X size={16} className="mr-1" />
              キャンセル
            </Button>
            
            <Button
              size="sm"
              onClick={onSave}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save size={16} className="mr-1" />
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-orange-700 mt-2">
          変更を保存するまで、データベースには反映されません。
        </p>
      </CardContent>
    </Card>
  );
}