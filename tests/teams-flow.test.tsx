import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import type { ReactNode } from 'react';
import { GET, POST } from '@/app/api/teams/route';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';
import { teamService, type TeamInfo } from '@/services/team.service';
import TeamsPage from '@/app/teams/page';

const state = vi.hoisted(() => ({ teamInfo: null as TeamInfo | null }));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'owner' } })) }));
vi.mock('@/lib/cache', () => ({ cache: { del: vi.fn() }, CacheKeys: {} }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'owner' } } }) }));
vi.mock('@/components/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/hooks/use-team', () => ({
  useTeam: () => ({ teamInfo: state.teamInfo, inviteCodes: [], loading: false }),
}));

function makeTeam() {
  const owner = {
    id: 'owner', username: 'owner', name: '团队主', avatar: null,
    githubId: '1', storageUsed: BigInt(0), fileCount: 0,
  };
  return {
    id: 'team', name: '测试团队', description: null, ownerId: 'owner',
    createdAt: new Date(), updatedAt: new Date(),
    storageQuota: BigInt(500 * 1024 * 1024), fileQuota: 1000,
    defaultStorageQuota: BigInt(100 * 1024 * 1024), defaultFileQuota: 100,
    owner,
    members: [{
      id: 'owner-member', teamId: 'team', userId: 'owner', role: 'ADMIN',
      joinedAt: new Date(), storageQuota: null as bigint | null,
      fileQuota: null as number | null, user: owner,
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.teamInfo = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Team API → service → page regression', () => {
  it('renders a newly created team after fetching the actual GET response', async () => {
    const team = makeTeam();
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ team, role: 'ADMIN' } as never);
    const response = await GET();
    const raw = await response.clone().json();
    expect(raw.team.storageQuota).toEqual({ __bigint: '524288000' });
    vi.stubGlobal('fetch', vi.fn(async () => response));

    state.teamInfo = await teamService.getTeamInfo();
    expect(state.teamInfo.team?.storageQuota).toBe('524288000');
    expect(() => render(<TeamsPage />)).not.toThrow();
    expect(screen.getByText('测试团队')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('renders member usage and allocated quotas from tagged BigInts', async () => {
    const team = makeTeam();
    team.members.push({
      ...team.members[0], id: 'member-record', userId: 'member', role: 'MEMBER',
      storageQuota: BigInt(100 * 1024 * 1024), fileQuota: 100,
      user: { ...team.owner, id: 'member', username: 'member', name: '成员',
        storageUsed: BigInt(1024 * 1024), fileCount: 1 },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(
      serializeBigInt({ team, role: 'OWNER' }),
    ))));
    state.teamInfo = await teamService.getTeamInfo();

    expect(() => render(<TeamsPage />)).not.toThrow();
    expect(screen.getByText('成员')).toBeInTheDocument();
    expect(state.teamInfo.team?.members[1].storageQuota).toBe('104857600');
    expect(state.teamInfo.team?.members[1].user.storageUsed).toBe('1048576');
  });

  it('preserves null quotas and existing string responses, including large integers', async () => {
    const team = JSON.parse(JSON.stringify(serializeBigInt(makeTeam())));
    team.storageQuota = '9007199254740993';
    team.defaultStorageQuota = null;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ team, role: 'OWNER' }))));
    const info = await teamService.getTeamInfo();
    expect(BigInt(info.team!.storageQuota)).toBe(BigInt('9007199254740993'));
    expect(info.team?.defaultStorageQuota).toBeNull();
    expect(info.team?.members[0].storageQuota).toBeNull();
  });

  it('persists custom creation quotas and decodes the POST response', async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.team.create).mockResolvedValue(makeTeam() as never);
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => POST(
      new NextRequest('http://localhost/api/teams', {
        method: init.method, headers: init.headers, body: init.body,
      }),
    )));

    const result = await teamService.createTeam('测试团队', undefined, 750, 2000);
    expect(prisma.team.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ storageQuota: BigInt(750 * 1024 * 1024), fileQuota: 2000 }),
      include: expect.objectContaining({
        members: { include: { user: { select: expect.objectContaining({ storageUsed: true, fileCount: true }) } } },
      }),
    }));
    expect(result.team.storageQuota).toBe('524288000');
  });

  it('rejects invalid creation quotas before writing to the database', async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);
    const response = await POST(new NextRequest('http://localhost/api/teams', {
      method: 'POST', body: JSON.stringify({ name: '测试团队', storageQuotaMB: -1, fileQuota: 1.5 }),
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(response.status).toBe(400);
    expect(prisma.team.create).not.toHaveBeenCalled();
  });
});
