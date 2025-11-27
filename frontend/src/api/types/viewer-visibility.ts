import type { UUID } from './common';

export type ViewerSubjectType = 'user' | 'department' | 'supervisor_team';
export type ViewerResourceType = 'user' | 'goal' | 'evaluation' | 'assessment' | 'department' | 'stage';

export interface ViewerVisibilityGrantItem {
  subject_type: ViewerSubjectType;
  subject_id: UUID;
  resource_type: ViewerResourceType;
  created_by?: UUID | null;
  created_at: string;
}

export interface ViewerVisibilityResponse {
  viewer_user_id: UUID;
  version: string;
  grants: ViewerVisibilityGrantItem[];
}

export interface ViewerVisibilityOverridePayload {
  subject_type: ViewerSubjectType;
  subject_id: UUID;
  resource_type: ViewerResourceType;
}

export interface ViewerVisibilityUpdateRequest {
  grants: ViewerVisibilityOverridePayload[];
  version?: string;
}

export interface ViewerVisibilityPatchRequest {
  add?: ViewerVisibilityOverridePayload[];
  remove?: ViewerVisibilityOverridePayload[];
  version?: string;
}
