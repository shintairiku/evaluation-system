import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'アクセス拒否 | 人事評価システム',
  description: 'このページにアクセスする権限がありません'
};

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            アクセス拒否
          </h1>

          {/* Description */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Access Denied</span>
            </div>
            <p className="text-gray-600 leading-relaxed">
              申し訳ございませんが、このページにアクセスする権限がありません。管理者権限が必要です。
            </p>
            <p className="text-sm text-gray-500">
              アクセス権限について不明な点がございましたら、システム管理者にお問い合わせください。
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
              <Link href="/" className="flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                ダッシュボードに戻る
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/user-profiles">
                ユーザープロフィール
              </Link>
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              管理者機能には組織の管理者権限が必要です
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}