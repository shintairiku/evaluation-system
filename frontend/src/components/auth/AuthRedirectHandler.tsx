"use client";

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { checkUserExistsAction } from '@/api/server-actions/users';

/**
 * Client-side component that handles automatic redirection after Clerk authentication
 * This ensures smooth user flow without requiring page reloads
 */
export default function AuthRedirectHandler() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      // Wait for Clerk to load user data
      if (!isLoaded) return;
      
      // If user is signed in, check if they need to complete profile
      if (user) {
        try {
          console.log('AuthRedirectHandler: Checking user status for', user.id);
          
          // Check Clerk metadata first to see if profile is completed
          const profileCompleted = user.unsafeMetadata?.profileCompleted;
          console.log('AuthRedirectHandler: Profile completed in metadata:', profileCompleted);
          
          // If profile is not marked as completed in Clerk, redirect to profile
          if (!profileCompleted) {
            console.log('AuthRedirectHandler: Profile not completed, redirecting to profile');
            router.push('/profile');
            return;
          }
          
          // Double-check with backend
          const userResult = await checkUserExistsAction(user.id);
          
          if (!userResult.success || !userResult.data) {
            console.log('AuthRedirectHandler: API call failed, redirecting to profile');
            router.push('/profile');
            return;
          }

          const userCheck = userResult.data;
          
          // If user doesn't exist in database, redirect to profile creation
          if (!userCheck.exists) {
            console.log('AuthRedirectHandler: User not in database, redirecting to profile');
            router.push('/profile');
            return;
          }
          
          console.log('AuthRedirectHandler: User exists, status:', userCheck.status);
          
          // User exists and we're already on the main page - stay here
          // The main page will handle inactive users appropriately
          
        } catch (error) {
          console.error('AuthRedirectHandler: Error checking user status:', error);
          // On error, redirect to profile to be safe
          router.push('/profile');
        }
      }
    };

    // Small delay to ensure Clerk state is fully updated
    const timeoutId = setTimeout(checkAndRedirect, 500);

    return () => clearTimeout(timeoutId);
  }, [user, isLoaded, router]);

  // This component doesn't render anything visible
  return null;
}