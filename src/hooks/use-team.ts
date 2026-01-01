import { useState, useEffect, useCallback } from 'react';
import { teamService, TeamInfo, InviteCode } from '@/services/team.service';
import { toast } from 'sonner';

export function useTeam() {
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTeamInfo = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);
    try {
      const data = await teamService.getTeamInfo();
      
      const elapsed = Date.now() - startTime;
      const minLoadTime = 300;
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }

      setTeamInfo(data);
    } catch (error) {
      console.error('Error loading team info:', error);
      
      if (error instanceof Error && error.message.includes('401')) {
        window.location.href = '/auth/signin';
        return;
      }
      
      toast.error('无法加载团队信息', {
        description: '请检查网络连接或刷新页面'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeamInfo();
  }, [loadTeamInfo]);

  const createTeam = async (name: string, description?: string, storageQuotaMB?: number, fileQuota?: number) => {
    setLoading(true);
    try {
      const result = await teamService.createTeam(name, description, storageQuotaMB, fileQuota);
      
      // Reload team info
      await loadTeamInfo();
      
      toast.success('团队创建成功', {
        description: `欢迎来到 ${result.team.name}！`
      });
      
      return result;
    } catch (error) {
      console.error(error);
      toast.error('创建团队失败', {
        description: error instanceof Error ? error.message : '请重试'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTeam = async (name?: string, description?: string, storageQuotaMB?: number, fileQuota?: number, autoAllocateQuota?: boolean, defaultStorageQuotaMB?: number, defaultFileQuota?: number) => {
    setLoading(true);
    try {
      await teamService.updateTeam(name, description, storageQuotaMB, fileQuota, autoAllocateQuota, defaultStorageQuotaMB, defaultFileQuota);
      await loadTeamInfo();
      
      toast.success('团队信息已更新');
    } catch (error) {
      console.error(error);
      toast.error('更新失败', {
        description: '请重试'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async () => {
    setLoading(true);
    try {
      await teamService.deleteTeam();
      await loadTeamInfo();
      
      toast.success('团队已解散');
    } catch (error) {
      console.error(error);
      toast.error('解散团队失败', {
        description: '请重试'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    setLoading(true);
    try {
      await teamService.removeMember(userId);
      await loadTeamInfo();
      
      toast.success('成员已移除');
    } catch (error) {
      console.error(error);
      toast.error('移除成员失败', {
        description: '请重试'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (userId: string, role: 'ADMIN' | 'MEMBER') => {
    setLoading(true);
    try {
      await teamService.updateMemberRole(userId, role);
      await loadTeamInfo();
      
      toast.success('角色已更新');
    } catch (error) {
      console.error(error);
      toast.error('更新角色失败', {
        description: '请重试'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (expiresInHours: number = 24, maxUses: number = 5) => {
    try {
      const result = await teamService.generateInvite(expiresInHours, maxUses);
      
      toast.success('邀请码已生成');
      
      return result;
    } catch (error) {
      console.error(error);
      toast.error('生成邀请码失败', {
        description: '请重试'
      });
      throw error;
    }
  };

  const joinTeam = async (inviteCode: string) => {
    setLoading(true);
    try {
      const result = await teamService.joinTeam(inviteCode);
      await loadTeamInfo();
      
      toast.success('成功加入团队', {
        description: `欢迎加入 ${result.team.name}！`
      });
      
      return result;
    } catch (error) {
      console.error(error);
      toast.error('加入团队失败', {
        description: error instanceof Error ? error.message : '请检查邀请码'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const leaveTeam = async () => {
    setLoading(true);
    try {
      await teamService.leaveTeam();
      await loadTeamInfo();
      
      toast.success('已退出团队');
    } catch (error) {
      console.error(error);
      toast.error('退出团队失败', {
        description: error instanceof Error ? error.message : '请重试'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadInviteCodes = useCallback(async () => {
    try {
      const data = await teamService.getInviteCodes();
      setInviteCodes(data.invites);
    } catch (error) {
      console.error('Error loading invite codes:', error);
      // Don't show error toast, just fail silently
      setInviteCodes([]);
    }
  }, []);

  const setMemberQuota = async (userId: string, storageQuota?: number | null, fileQuota?: number | null) => {
    try {
      await teamService.setMemberQuota(userId, storageQuota, fileQuota);
      await loadTeamInfo(); // Refresh to show updated quota
      toast.success('配额设置成功');
    } catch (error) {
      console.error(error);
      toast.error('设置配额失败', {
        description: error instanceof Error ? error.message : '请重试'
      });
      throw error;
    }
  };

  const deleteInviteCode = async (id: string) => {
    try {
      await teamService.deleteInviteCode(id);
      await loadInviteCodes();
      toast.success('邀请码已删除');
    } catch (error) {
      console.error(error);
      toast.error('删除邀请码失败', {
        description: error instanceof Error ? error.message : '请重试'
      });
      throw error;
    }
  };

  return {
    teamInfo,
    inviteCodes,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    removeMember,
    updateMemberRole,
    generateInvite,
    joinTeam,
    leaveTeam,
    loadInviteCodes,
    setMemberQuota,
    deleteInviteCode,
    refresh: loadTeamInfo,
  };
}
