import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Header() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-primary shadow-md h-[45px]">
      <div>
        <p className="text-xl font-bold text-white">shintairiku</p>
      </div>
      <div className="flex items-center">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="bg-white text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
              ログイン
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "h-8 w-8"
              }
            }}
          />
        </SignedIn>
      </div>
    </div>
  );
}