"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

// This hook redirects users to profile completion if they haven't completed their profile
export function useProfileRedirect() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Check if user has completed profile by checking metadata or making API call
    // Using unsafeMetadata since that's what we can update from the frontend
    const hasCompletedProfile = user.unsafeMetadata?.profileCompleted;
    const userStatus = user.unsafeMetadata?.status;

    // If user status is pending_approval, redirect to pending page
    if (userStatus === 'pending_approval') {
      router.push('/profile/confirmation');
      return;
    }

    // If user hasn't completed profile, redirect to profile completion
    if (!hasCompletedProfile && userStatus !== 'active') {
      router.push('/profile');
      return;
    }
  }, [isLoaded, user, router]);

  return { isLoaded, user };
}