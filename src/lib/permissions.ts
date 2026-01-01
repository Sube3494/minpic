// Permission definitions for RBAC (Role-Based Access Control)

export const PERMISSIONS = {
  // User management
  USER_VIEW_ALL: ['ADMIN'],
  USER_CREATE: ['ADMIN'],
  USER_UPDATE: ['ADMIN'],
  USER_DELETE: ['ADMIN'],
  USER_SUSPEND: ['ADMIN'],

  
  // Whitelist management
  WHITELIST_VIEW: ['ADMIN'],
  WHITELIST_ADD: ['ADMIN'],
  WHITELIST_REMOVE: ['ADMIN'],
  
  // System settings
  SETTINGS_VIEW: ['ADMIN'],
  SETTINGS_UPDATE: ['ADMIN'],
  
  // Audit logs
  AUDIT_VIEW: ['ADMIN'],
  
  // File management
  FILE_UPLOAD: ['ADMIN', 'USER'],
  FILE_VIEW_OWN: ['ADMIN', 'USER'],
  FILE_VIEW_ALL: ['ADMIN'],
  FILE_DELETE_OWN: ['ADMIN', 'USER'],
  FILE_DELETE_ALL: ['ADMIN'],
  
  // Config management
  CONFIG_MANAGE_OWN: ['ADMIN', 'USER'],
  CONFIG_VIEW_ALL: ['ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export function hasPermission(
  userRole: UserRole,
  userStatus: UserStatus,
  permission: Permission
): boolean {
  // Banned or suspended users have no permissions
  if (userStatus !== 'ACTIVE') {
    return false;
  }
  
  return (PERMISSIONS[permission] as readonly string[]).includes(userRole);
}

export function requirePermission(
  userRole: UserRole,
  userStatus: UserStatus,
  permission: Permission
): void {
  if (!hasPermission(userRole, userStatus, permission)) {
    throw new Error('Insufficient permissions');
  }
}
