"use client";

import { useAuth } from '@clerk/nextjs';
import { ProfileOptionsProvider } from '@/context/ProfileOptionsContext';
import ProfileFormWrapper from '../display/ProfileFormWrapper';

export default function OrganizationAwareProfileWrapper() {
  const { orgId } = useAuth();

  return (
    <ProfileOptionsProvider orgId={orgId}>
      <ProfileFormWrapper orgId={orgId} />
    </ProfileOptionsProvider>
  );
}