export interface Team {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    githubId: string;
    storageQuota: string;
    storageUsed: string;
    fileQuota: number;
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
  storageQuota?: string | null;
  fileQuota?: number | null;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    githubId: string;
    storageUsed: string;
    fileCount: number;
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
}

export const teamService = {
  // Get current user's team info
  async getTeamInfo(): Promise<TeamInfo> {
    const res = await fetch('/api/teams');
    if (!res.ok) throw new Error('Failed to fetch team info');
    return res.json();
  },

  // Create team
  async createTeam(name: string, description?: string): Promise<{ team: Team; role: string }> {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create team');
    }
    return res.json();
  },

  // Update team
  async updateTeam(name?: string, description?: string): Promise<{ team: Team }> {
    const res = await fetch('/api/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error('Failed to update team');
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
  },

  // Set member quota
  async setMemberQuota(userId: string, storageQuota?: number | null, fileQuota?: number | null): Promise<void> {
    const res = await fetch('/api/teams/members/quota', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, storageQuota, fileQuota }),
    });
    if (!res.ok) throw new Error('Failed to set member quota');
  },
};
