"use client";

import { useUser } from '@clerk/nextjs';

export default function ClerkInfoCard() {
  const { user } = useUser();

  if (!user) {
    return null;
  }

  // Get name from Clerk user data
  const fullName = user.firstName && user.lastName 
    ? `${user.lastName} ${user.firstName}` // Japanese style: surname first
    : user.fullName || "";

  const email = user.primaryEmailAddress?.emailAddress || '';

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
      <h3 className="font-medium text-green-900 mb-2">Clerk情報</h3>
      <div className="text-sm text-green-700 space-y-1">
        <p>名前: {fullName}</p>
        <p>メール: {email}</p>
      </div>
    </div>
  );
} 