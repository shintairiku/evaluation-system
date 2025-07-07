"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function ConfirmationDisplay() {
  const router = useRouter();

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">承認待ち</CardTitle>
          <CardDescription>
            プロフィール情報の送信が完了しました
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            <p className="font-medium">承認処理中</p>
            <p className="text-sm mt-1">
              管理者がアカウントを確認し、承認処理を行います。承認完了後、システムの全機能をご利用いただけます。
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">次のステップ</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• 管理者がプロフィール情報を確認します</li>
              <li>• 承認完了後、メール通知が送信されます</li>
              <li>• 承認後、システムにアクセスできるようになります</li>
            </ul>
          </div>

          <div className="border-t pt-6">
            <p className="text-sm text-gray-500 mb-4">
              承認には通常1-2営業日かかります。お急ぎの場合は管理者にお問い合わせください。
            </p>
            
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
            >
              ホームに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 