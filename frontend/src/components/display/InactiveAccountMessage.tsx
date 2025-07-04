export default function InactiveAccountMessage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          アカウントが無効です
        </h2>
        <p className="text-gray-600">
          管理者にお問い合わせください。
        </p>
      </div>
    </div>
  );
} 