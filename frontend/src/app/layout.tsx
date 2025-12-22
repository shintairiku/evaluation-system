import type { Metadata } from "next";
import "./globals.css";
import "@/styles/accessibility.css";
import { ClerkProvider } from "@clerk/nextjs";
import { jaJP } from "@clerk/localizations";
import { LoadingProvider } from "@/context/LoadingContext";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Evaluation System",
  description: "Employee evaluation management system",
};

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
            {children}
            <Toaster richColors position="top-right" />
          </LoadingProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
