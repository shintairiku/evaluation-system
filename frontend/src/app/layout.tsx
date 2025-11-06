import type { Metadata } from "next";
import "./globals.css";
import "@/styles/accessibility.css";
import { ClerkProvider } from "@clerk/nextjs";
import { jaJP } from "@clerk/localizations";
import { LoadingProvider } from "@/context/LoadingContext";
import { GoalReviewProvider } from "@/context/GoalReviewContext";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Evaluation System",
  description: "Employee evaluation management system",
};

// Force dynamic rendering to avoid prerendering during build
// This prevents requiring valid Clerk keys at build time
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider 
      localization={jaJP}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signUpForceRedirectUrl="/setup"
    >
      <html lang="ja" suppressHydrationWarning>
        <head />
        <body className="font-sans antialiased">
          <LoadingProvider>
            <GoalReviewProvider>
              {children}
              <Toaster richColors position="top-right" />
            </GoalReviewProvider>
          </LoadingProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
