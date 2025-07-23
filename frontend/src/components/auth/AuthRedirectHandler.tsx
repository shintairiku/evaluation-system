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
      if (!isLoaded || hasChecked || pathname !== '/' || !user) return;
      
      setHasChecked(true);
      
      try {
        const profileCompleted = user.unsafeMetadata?.profileCompleted;
        
        if (!profileCompleted) {
          router.push('/profile');
          return;
        }
        
        const userResult = await checkUserExistsAction(user.id);
        
        if (!userResult.success || !userResult.data) {
          router.push('/profile');
          return;
        }

        const userCheck = userResult.data;
        
        if (!userCheck.exists) {
          router.push('/profile');
          return;
        }
      } catch (error) {
        console.error('AuthRedirectHandler: Error checking user status:', error);
        router.push('/profile');
      }
    };

    const timeoutId = setTimeout(checkAndRedirect, 500);
    return () => clearTimeout(timeoutId);
  }, [user, isLoaded, router, pathname, hasChecked]);

  // This component doesn't render anything visible
  return null;
}