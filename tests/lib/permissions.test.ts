import { describe, it, expect } from 'vitest';
import { hasPermission, PERMISSIONS, type Permission } from '@/lib/permissions';

describe('Permissions System', () => {
  describe('hasPermission', () => {
    it('should grant permissions to ADMIN role when ACTIVE', () => {
      // ADMIN 用户应该有所有 ADMIN 权限
      expect(hasPermission('ADMIN', 'ACTIVE', 'USER_VIEW_ALL')).toBe(true);
      expect(hasPermission('ADMIN', 'ACTIVE', 'WHITELIST_VIEW')).toBe(true);
      expect(hasPermission('ADMIN', 'ACTIVE', 'SETTINGS_VIEW')).toBe(true);
      expect(hasPermission('ADMIN', 'ACTIVE', 'AUDIT_VIEW')).toBe(true);
      expect(hasPermission('ADMIN', 'ACTIVE', 'FILE_VIEW_ALL')).toBe(true);
    });

    it('should grant limited permissions to USER role when ACTIVE', () => {
      // USER 只能管理自己的文件和配置
      expect(hasPermission('USER', 'ACTIVE', 'FILE_UPLOAD')).toBe(true);
      expect(hasPermission('USER', 'ACTIVE', 'FILE_VIEW_OWN')).toBe(true);
      expect(hasPermission('USER', 'ACTIVE', 'FILE_DELETE_OWN')).toBe(true);
      expect(hasPermission('USER', 'ACTIVE', 'CONFIG_MANAGE_OWN')).toBe(true);
      
      // USER 不能查看所有用户或管理系统
      expect(hasPermission('USER', 'ACTIVE', 'USER_VIEW_ALL')).toBe(false);
      expect(hasPermission('USER', 'ACTIVE', 'WHITELIST_VIEW')).toBe(false);
      expect(hasPermission('USER', 'ACTIVE', 'FILE_VIEW_ALL')).toBe(false);
    });

    it('should deny all permissions when user is SUSPENDED', () => {
      // 被暂停的用户没有任何权限
      expect(hasPermission('ADMIN', 'SUSPENDED', 'USER_VIEW_ALL')).toBe(false);
      expect(hasPermission('USER', 'SUSPENDED', 'FILE_UPLOAD')).toBe(false);
      expect(hasPermission('USER', 'SUSPENDED', 'FILE_VIEW_OWN')).toBe(false);
    });

    // Note: TypeScript 类型系统已经防止了无效权限的传递
    // 所以不需要测试无效权限的情况
  });

  describe('Permission hierarchy', () => {
    it('should verify ADMIN has more permissions than USER', () => {
      const allPermissions = Object.keys(PERMISSIONS) as Permission[];
      
      const adminPermCount = allPermissions.filter(p => 
        hasPermission('ADMIN', 'ACTIVE', p)
      ).length;
      const userPermCount = allPermissions.filter(p => 
        hasPermission('USER', 'ACTIVE', p)
      ).length;

      // ADMIN 应该有更多权限
      expect(adminPermCount).toBeGreaterThan(userPermCount);
      // USER 应该至少有一些权限
      expect(userPermCount).toBeGreaterThan(0);
    });

    it('should verify specific permission assignments', () => {
      // 验证管理员专属权限
      const adminOnlyPerms: Permission[] = [
        'USER_VIEW_ALL',
        'WHITELIST_VIEW',
        'SETTINGS_VIEW',
        'AUDIT_VIEW',
      ];

      adminOnlyPerms.forEach(perm => {
        expect(hasPermission('ADMIN', 'ACTIVE', perm)).toBe(true);
        expect(hasPermission('USER', 'ACTIVE', perm)).toBe(false);
      });

      // 验证共享权限
      const sharedPerms: Permission[] = [
        'FILE_UPLOAD',
        'FILE_VIEW_OWN',
        'CONFIG_MANAGE_OWN',
      ];

      sharedPerms.forEach(perm => {
        expect(hasPermission('ADMIN', 'ACTIVE', perm)).toBe(true);
        expect(hasPermission('USER', 'ACTIVE', perm)).toBe(true);
      });
    });

    it('should verify suspended users have no permissions', () => {
      const allPermissions = Object.keys(PERMISSIONS) as Permission[];
      
      // 所有权限对于 SUSPENDED 用户都应该是 false
      allPermissions.forEach(p => {
        expect(hasPermission('ADMIN', 'SUSPENDED', p)).toBe(false);
        expect(hasPermission('USER', 'SUSPENDED', p)).toBe(false);
      });
    });
  });
});
