import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                新大陸 人事システム
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                従業員評価管理システムへようこそ
              </p>
              <SignInButton mode="redirect">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                  サインインして開始
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex mt-[45px]">
          <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
            <Sidebar />
          </div>
          <main className="flex-1 ml-[314px] p-6">
            {/* ここにサインイン後のホームのページを追加 */}
          </main>
        </div>
      </SignedIn>
    </div>
  );
}
