'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { permissionsApi } from '../endpoints/permissions';
import { CACHE_TAGS } from '../utils/cache';
import type {
  PermissionCatalogGroupedResponse,
  PermissionCatalogItem,
  RolePermissionCloneRequest,
  RolePermissionPatchRequest,
  RolePermissionResponse,
  RolePermissionUpdateRequest,
  UUID,
} from '../types';

type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getPermissionCatalogAction(): Promise<ActionResult<PermissionCatalogItem[]>> {
  try {
    const response = await permissionsApi.getCatalog();
    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to load permission catalog' };
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('getPermissionCatalog error', error);
    return { success: false, error: 'Unexpected error while loading permission catalog' };
  }
}

const getPermissionCatalogGroupedCached = cache(async () => {
  const response = await permissionsApi.getGroupedCatalog();
  if (!response.success || !response.data) {
    throw new Error(response.errorMessage || 'Failed to load grouped permission catalog');
  }
  return response.data;
});

export async function getPermissionCatalogGroupedAction(): Promise<ActionResult<PermissionCatalogGroupedResponse>> {
  try {
    const data = await getPermissionCatalogGroupedCached();
    return { success: true, data };
  } catch (error) {
    console.error('getPermissionCatalogGroupedAction error', error);
    const message = error instanceof Error ? error.message : 'Unexpected error while loading grouped permission catalog';
    return { success: false, error: message };
  }
}

export async function getRolePermissionsAction(roleId: UUID): Promise<ActionResult<RolePermissionResponse>> {
  try {
    const response = await permissionsApi.getRolePermissions(roleId);
    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to load role permissions' };
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('getRolePermissions error', error);
    return { success: false, error: 'Unexpected error while loading role permissions' };
  }
}

export async function getAllRolePermissionsAction(): Promise<ActionResult<RolePermissionResponse[]>> {
  try {
    const response = await permissionsApi.getAllRolePermissions();
    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to load role permissions' };
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('getAllRolePermissions error', error);
    return { success: false, error: 'Unexpected error while loading role permissions' };
  }
}

async function mutateRolePermissions<T extends RolePermissionUpdateRequest | RolePermissionPatchRequest | RolePermissionCloneRequest>(
  mutate: () => Promise<ActionResult<RolePermissionResponse>>,
): Promise<ActionResult<RolePermissionResponse>> {
  const result = await mutate();
  if (result.success) {
    revalidateTag(CACHE_TAGS.ROLES);
    revalidateTag(CACHE_TAGS.PERMISSIONS);
  }
  return result;
}

export async function replaceRolePermissionsAction(
  roleId: UUID,
  payload: RolePermissionUpdateRequest,
): Promise<ActionResult<RolePermissionResponse>> {
  return mutateRolePermissions(async () => {
    try {
      const response = await permissionsApi.replaceRolePermissions(roleId, payload);
      if (!response.success || !response.data) {
        return { success: false, error: response.errorMessage || 'Failed to update permissions' };
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error('replaceRolePermissionsAction error', error);
      return { success: false, error: 'Unexpected error while updating permissions' };
    }
  });
}

export async function patchRolePermissionsAction(
  roleId: UUID,
  payload: RolePermissionPatchRequest,
): Promise<ActionResult<RolePermissionResponse>> {
  return mutateRolePermissions(async () => {
    try {
      const response = await permissionsApi.patchRolePermissions(roleId, payload);
      if (!response.success || !response.data) {
        return { success: false, error: response.errorMessage || 'Failed to update permissions' };
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error('patchRolePermissionsAction error', error);
      return { success: false, error: 'Unexpected error while updating permissions' };
    }
  });
}

export async function cloneRolePermissionsAction(
  roleId: UUID,
  payload: RolePermissionCloneRequest,
): Promise<ActionResult<RolePermissionResponse>> {
  return mutateRolePermissions(async () => {
    try {
      const response = await permissionsApi.cloneRolePermissions(roleId, payload);
      if (!response.success || !response.data) {
        return { success: false, error: response.errorMessage || 'Failed to clone permissions' };
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error('cloneRolePermissionsAction error', error);
      return { success: false, error: 'Unexpected error while cloning permissions' };
    }
  });
}
