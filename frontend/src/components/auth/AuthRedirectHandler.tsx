"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { checkUserExistsAction } from '@/api/server-actions/users';

export default function AuthRedirectHandler() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    setHasChecked(false);
  }, [user?.id]);

  useEffect(() => {
    const checkAndRedirect = async () => {
      // Allow redirect logic on multiple paths
      const allowedPaths = ['/', '/sign-in'];
      if (!isLoaded || hasChecked || !allowedPaths.includes(pathname) || !user) return;
      
      setHasChecked(true);
      
      try {
        // Check user existence and profile completion via backend API
        const userResult = await checkUserExistsAction(user.id);
        
        if (!userResult.success || !userResult.data) {
          router.push('/setup');
          return;
        }

        const userCheck = userResult.data;
        
        if (!userCheck.exists) {
          router.push('/setup');
          return;
        }

        // ✅ Redirect existing users to home page (regardless of status)
        router.push('/');
      } catch (error) {
        console.error('AuthRedirectHandler: Error checking user status:', error);
        router.push('/setup');
      }
    };

    const timeoutId = setTimeout(checkAndRedirect, 500);
    return () => clearTimeout(timeoutId);
  }, [user, isLoaded, router, pathname, hasChecked]);

  // This component doesn't render anything visible
  return null;
}