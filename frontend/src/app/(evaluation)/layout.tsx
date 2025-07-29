import { Suspense } from 'react';
import Header from '@/components/display/header';
import Sidebar from '@/components/display/sidebar';
import { ProfileOptionsProvider } from '@/context/ProfileOptionsContext';

interface EvaluationLayoutProps {
  children: React.ReactNode;
}

export default function EvaluationLayout({ children }: EvaluationLayoutProps) {
  return (
    <ProfileOptionsProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 ml-64 p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            }>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </ProfileOptionsProvider>
  );
}