'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface ActionButtonsProps {
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
  isApproving?: boolean;
  isRejecting?: boolean;
  disabled?: boolean;
}

export function ActionButtons({
  onApprove,
  onReject,
  isProcessing = false,
  isApproving = false,
  isRejecting = false,
  disabled = false
}: ActionButtonsProps) {
  const isDisabled = disabled || isProcessing || isApproving || isRejecting;

  return (
    <div className="flex gap-3 justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReject}
        disabled={isDisabled}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        {isRejecting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2" />
            差し戻し中...
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 mr-2" />
            差し戻し
          </>
        )}
      </Button>

      <Button
        type="button"
        size="sm"
        onClick={onApprove}
        disabled={isDisabled}
        className="bg-green-600 hover:bg-green-700"
      >
        {isApproving ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            承認中...
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            承認
          </>
        )}
      </Button>
    </div>
  );
}