import { SignedIn, SignedOut, SignInButton, UserButton, OrganizationSwitcher } from "@clerk/nextjs";

const isStaging = process.env.NEXT_PUBLIC_STAGING === "true";

export default function Header() {
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-4 shadow-md h-[45px] ${isStaging ? "bg-red-600" : "bg-primary"}`}>
      <div className="flex items-center gap-2">
        <p className="text-xl font-bold text-white">Zinzineer</p>
        {isStaging && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded">テスト環境</span>}
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
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              hidePersonal
              appearance={{
                elements: {
                  organizationSwitcherTrigger: "text-white border-white/20",
                  organizationSwitcherTriggerIcon: "text-white"
                }
              }}
            />
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8"
                }
              }}
            />
          </div>
        </SignedIn>
      </div>
    </div>
  );
}