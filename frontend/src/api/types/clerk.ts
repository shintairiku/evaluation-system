import { UUID } from './common';

// Clerk Public Metadata Interface
export interface ClerkPublicMetadata {
  users_table_id?: UUID;
  role?: string;
  roles?: string[];
  profile_completed?: boolean;
}

// Clerk Private Metadata Interface
export interface ClerkPrivateMetadata {
  email?: string;
}

// JWT Claims Interface (based on the Clerk JWT template)
// Note: organization_id and organization_name are populated from Clerk's native {{org.id}} and {{org.name}}
// internal_user_id is populated from {{user.public_metadata.users_table_id}}
export interface JWTClaims {
  role?: string; // Populated from {{user.public_metadata.role}}
  roles?: string[]; // Populated from {{user.public_metadata.roles}}
  organization_id?: string; // Populated from {{org.id}}
  internal_user_id?: string; // Populated from {{user.public_metadata.users_table_id}}
  organization_name?: string; // Populated from {{org.name}}
}

// Organization Interface
export interface Organization {
  id: string; // Clerk organization ID
  name: string;
  slug?: string;
  created_at: string;
  updated_at: string;
}

// Organization Create Request
export interface OrganizationCreate {
  name: string;
  slug?: string;
}

// Organization Update Request
export interface OrganizationUpdate {
  name?: string;
  slug?: string;
}

// Domain Settings for Auto-Approval
export interface DomainSettings {
  id: UUID;
  organization_id: string;
  domain: string;
  auto_join_enabled: boolean;
  verification_status: 'pending' | 'verified' | 'failed';
  created_at: string;
  updated_at: string;
}

// Domain Settings Create Request
export interface DomainSettingsCreate {
  organization_id: string;
  domain: string;
  auto_join_enabled: boolean;
}

// Domain Settings Update Request
export interface DomainSettingsUpdate {
  auto_join_enabled?: boolean;
}

// Organization Member Interface
export interface OrganizationMember {
  id: UUID;
  clerk_user_id: string;
  organization_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: {
    id: UUID;
    name: string;
    email: string;
    employee_code: string;
  };
}

// Webhook Event Types
export type ClerkWebhookEventType = 
  | 'user.created' 
  | 'user.updated' 
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organizationMembership.created'
  | 'organizationMembership.updated'
  | 'organizationMembership.deleted';

// Webhook Payload Interface
export interface ClerkWebhookPayload {
  type: ClerkWebhookEventType;
  object: string;
  data: any; // This will vary based on the event type
}

// User Webhook Data
export interface UserWebhookData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    id: string;
  }>;
  first_name?: string;
  last_name?: string;
  public_metadata: ClerkPublicMetadata;
  private_metadata: ClerkPrivateMetadata;
  organization_memberships?: Array<{
    id: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    role: string;
  }>;
}

// Organization Webhook Data
export interface OrganizationWebhookData {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
  public_metadata: Record<string, any>;
  private_metadata: Record<string, any>;
}

// Organization Membership Webhook Data
export interface OrganizationMembershipWebhookData {
  id: string;
  role: 'admin' | 'basic_member';
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  public_user_data: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
  };
}