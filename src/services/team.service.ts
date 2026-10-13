import { readApiResponse } from '@/lib/api-response';

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  storageQuota: string;  // Team-level quota (BigInt as string)
  fileQuota: number;     // Team-level quota
  autoAllocateQuota?: boolean;
  defaultStorageQuota?: string;
  defaultFileQuota?: number;
  owner: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    githubId: string;
    storageUsed: string;
    fileCount: number;
  };
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;  // ADMIN | MEMBER
  joinedAt: string;
  storageQuota?: string | null;  // Member's personal quota (optional)
  fileQuota?: number | null;     // Member's personal quota (optional)
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    githubId: string;
    storageUsed: string;  // Usage stats only
    fileCount: number;    // Usage stats only
  };
}

export interface TeamInfo {
  team: Team | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
}

export interface InviteCode {
  id: string;
  code: string;
  teamId: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  members?: Array<{
    id: string;
    user: {
      id: string;
      username: string;
      name: string | null;
      avatar: string | null;
    };
  }>;
}

export const teamService = {
  // Get current user's team info
  async getTeamInfo(): Promise<TeamInfo> {
    const res = await fetch('/api/teams');
    if (!res.ok) throw new Error('Failed to fetch team info');
    return readApiResponse(res);
  },

  // Create team
  async createTeam(name: string, description?: string, storageQuotaMB?: number, fileQuota?: number): Promise<{ team: Team; role: string }> {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        description,
        storageQuotaMB: storageQuotaMB || 500,  // 默认 500MB
        fileQuota: fileQuota || 1000,          // 默认1000文件
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create team');
    }
    return readApiResponse(res);
  },

  // Update team
  async updateTeam(name?: string, description?: string, storageQuotaMB?: number, fileQuota?: number, autoAllocateQuota?: boolean, defaultStorageQuotaMB?: number, defaultFileQuota?: number): Promise<{ team: Team }> {
    const res = await fetch('/api/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, storageQuotaMB, fileQuota, autoAllocateQuota, defaultStorageQuotaMB, defaultFileQuota }),
    });
    if (!res.ok) throw new Error('Failed to update team');
    return readApiResponse(res);
  },

  // Delete team
  async deleteTeam(): Promise<void> {
    const res = await fetch('/api/teams', {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete team');
  },

  // Get team members
  async getMembers(): Promise<{ members: TeamMember[] }> {
    const res = await fetch('/api/teams/members');
    if (!res.ok) throw new Error('Failed to fetch members');
    return readApiResponse(res);
  },

  // Remove member
  async removeMember(userId: string): Promise<void> {
    const res = await fetch(`/api/teams/members?userId=${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove member');
  },

  // Update member role
  async updateMemberRole(userId: string, role: 'ADMIN' | 'MEMBER'): Promise<{ member: TeamMember }> {
    const res = await fetch(`/api/teams/members?userId=${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error('Failed to update member role');
    return readApiResponse(res);
  },

  // Generate invite code
  async generateInvite(expiresInMinutes: number = 1440, maxUses: number = 10): Promise<{ inviteCode: string; expiresAt: string; maxUses: number; teamName: string }> {
    const res = await fetch('/api/teams/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInMinutes, maxUses }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to generate invite');
    }
    return readApiResponse(res);
  },

  // Delete invite code
  async deleteInviteCode(id: string): Promise<void> {
    const res = await fetch(`/api/teams/invites?id=${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete invite code');
    }
  },

  // Join team with invite code
  async joinTeam(inviteCode: string): Promise<{ success: boolean; team: Team }> {
    const res = await fetch('/api/teams/invite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to join team');
    }
    return readApiResponse(res);
  },

  // Leave team
  async leaveTeam(): Promise<void> {
    const res = await fetch('/api/teams/invite', {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to leave team');
    }
  },

  // Get invite codes
  async getInviteCodes(): Promise<{ invites: InviteCode[] }> {
    const res = await fetch('/api/teams/invites');
    if (!res.ok) throw new Error('Failed to fetch invite codes');
    return readApiResponse(res);
  },

  // Set member quota
  async setMemberQuota(userId: string, storageQuota?: number | null, fileQuota?: number | null): Promise<void> {
    const res = await fetch('/api/teams/members/quota', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, storageQuota, fileQuota }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || '设置成员配额失败');
    }
  },
};
