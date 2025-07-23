import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import WelcomeDashboard from "@/components/display/WelcomeDashboard";
import InactiveAccountMessage from "@/components/display/InactiveAccountMessage";
import LandingPage from "@/components/display/LandingPage";
import AuthRedirectHandler from "@/components/auth/AuthRedirectHandler";
import { checkUserExistsAction } from "@/api/server-actions/users";

async function SignedInContent() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Check if user exists in database
  const userResult = await checkUserExistsAction(userId);
  
  if (!userResult.success || !userResult.data) {
    // API call failed, redirect to profile creation
    redirect("/profile");
  }

  const userCheck = userResult.data;
  
  // If user doesn't exist in database, redirect to profile creation
  if (!userCheck.exists) {
    redirect("/profile");
  }
  
  // Only redirect inactive users - pending users can access the system
  if (userCheck.status === 'inactive') {
    return <InactiveAccountMessage />;
  }

  // User exists and can access the system - show main dashboard
  return (
    <div className="flex mt-[45px]">
      <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
        <Sidebar />
      </div>
      <main className="flex-1 ml-[314px] p-6">
        <WelcomeDashboard user={userCheck} />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        {/* Client-side redirect handler for smooth user flow */}
        <AuthRedirectHandler />
        <SignedInContent />
      </SignedIn>
    </div>
  );
}
