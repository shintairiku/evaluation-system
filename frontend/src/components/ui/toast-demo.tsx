'use client';

import { toast } from 'sonner';
import { Button } from './button';

/**
 * Demo component to test the enhanced toast functionality
 * Remove this component when no longer needed
 */
export function ToastDemo() {
  const showSuccessToast = () => {
    toast.success('操作が正常に完了しました', {
      description: 'データが正常に保存されました。変更内容が反映されます。',
      action: {
        label: '詳細を見る',
        onClick: () => toast.info('詳細情報を表示中...')
      }
    });
  };

  const showErrorToast = () => {
    toast.error('操作に失敗しました', {
      description: 'ネットワーク接続を確認して、もう一度お試しください。',
      action: {
        label: '再試行',
        onClick: () => toast.info('再試行中...')
      }
    });
  };

  const showInfoToast = () => {
    toast.info('新しい情報があります', {
      description: 'システムのアップデートが利用可能です。今すぐインストールしますか？'
    });
  };

  const showWarningToast = () => {
    toast.warning('注意が必要です', {
      description: 'この操作は取り消すことができません。続行する前に内容をご確認ください。'
    });
  };

  const showMultipleToasts = () => {
    toast.success('1番目のトースト');
    setTimeout(() => toast.info('2番目のトースト'), 500);
    setTimeout(() => toast.warning('3番目のトースト'), 1000);
    setTimeout(() => toast.error('4番目のトースト'), 1500);
    setTimeout(() => toast.success('5番目のトースト（スタック効果を確認）'), 2000);
  };

  const showLongMessage = () => {
    toast.success('非常に長いメッセージのテスト', {
      description: 'これは非常に長いメッセージです。トーストの幅が固定されているかどうか、そして長いテキストが適切に表示されるかどうかを確認するためのテストメッセージです。メッセージが途切れることなく、読みやすく表示されることを期待します。'
    });
  };

  return (
    <div className="p-6 space-y-4 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">トースト通知テスト</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={showSuccessToast} variant="default">
          成功トースト
        </Button>
        
        <Button onClick={showErrorToast} variant="destructive">
          エラートースト
        </Button>
        
        <Button onClick={showInfoToast} variant="outline">
          情報トースト
        </Button>
        
        <Button onClick={showWarningToast} variant="secondary">
          警告トースト
        </Button>
        
        <Button onClick={showMultipleToasts} variant="outline" className="col-span-2">
          複数トースト（スタック効果テスト）
        </Button>
        
        <Button onClick={showLongMessage} variant="outline" className="col-span-2">
          長いメッセージテスト
        </Button>
      </div>
      
      <div className="text-sm text-gray-600 mt-4">
        <p><strong>テスト項目:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>✅ 新しいトーストが上に表示される</li>
          <li>✅ 古いトーストが下に移動する</li>
          <li>✅ 最大4つまで表示（5つ目以降は自動的に消える）</li>
          <li>✅ 各トーストに閉じるボタンがある</li>
          <li>✅ ホバー時にスタック効果が一時停止</li>
          <li>✅ メッセージ幅が320px〜480pxで固定</li>
          <li>✅ 4秒後に自動消去（以前より長め）</li>
          <li>✅ スムーズなアニメーション効果</li>
        </ul>
      </div>
    </div>
  );
}