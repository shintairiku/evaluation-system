import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            評価システム
          </h1>
          <h2 className="text-lg text-gray-600">
            アカウントにサインインしてください
          </h2>
        </div>

        <div className="flex justify-center">
          <SignIn 
            redirectUrl="/"
            appearance={{
              elements: {
                formButtonPrimary: 
                  "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
                card: "bg-white shadow sm:rounded-lg px-10 py-8 w-full max-w-md",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: 
                  "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-sm",
                socialButtonsBlockButtonText: "text-gray-700 font-medium",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-500 text-sm",
                formFieldInput: 
                  "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
                footerActionLink: "text-blue-600 hover:text-blue-700",
              },
              layout: {
                socialButtonsPlacement: "top",
                socialButtonsVariant: "blockButton",
              },
            }}
            routing="path"
            path="/sign-in"
          />
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Google Workspaceアカウントをお持ちでない方は、
            <br />
            管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
} 