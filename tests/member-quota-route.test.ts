import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from '@/app/api/teams/members/quota/route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  team: { findUnique: vi.fn() },
  member: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  invalidate: vi.fn(),
}));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: mocks.auth }));
vi.mock('@/lib/prisma', () => ({ prisma: { team: mocks.team, teamMember: mocks.member } }));
vi.mock('@/lib/cache', () => ({
  cache: { del: mocks.invalidate }, CacheKeys: { userQuota: (id: string) => `quota:${id}` },
}));

const MB = 1024 * 1024;
const team = { id: 'team', ownerId: 'owner', storageQuota: BigInt(5120 * MB), fileQuota: 10000 };
const member = { id: 'member-record', userId: 'member', storageQuota: null, fileQuota: null };

async function setQuota(storageQuota?: number | null, fileQuota?: number | null) {
  return PATCH(new Request('http://localhost/api/teams/members/quota', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'member', storageQuota, fileQuota }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'owner' } });
  // A team owner can use more than the members' entire allocation pool.
  mocks.team.findUnique.mockResolvedValue({ ...team, owner: { storageUsed: BigInt(8192 * MB), fileCount: 20000 } });
  mocks.member.findFirst.mockResolvedValue(member);
  mocks.member.findMany.mockResolvedValue([
    { userId: 'owner', storageQuota: BigInt(5120 * MB), fileQuota: 10000 },
    member,
  ]);
  mocks.member.update.mockImplementation(async ({ data }) => ({ ...member, ...data }));
});

describe('Member quota allocation excludes team owner', () => {
  it('accepts the reported 1024 MB / 1000 files allocation regardless of owner usage', async () => {
    const response = await setQuota(1024 * MB, 1000);
    expect(response.status).toBe(200);
    expect(mocks.member.update).toHaveBeenCalledWith({
      where: { id: member.id }, data: { storageQuota: BigInt(1024 * MB), fileQuota: 1000 },
    });
    expect((await response.json()).member.storageQuota).toBe(String(1024 * MB));
    expect(mocks.invalidate).toHaveBeenCalledWith('quota:member');
  });

  it('accepts allocation up to the full members-only pool', async () => {
    expect((await setQuota(5120 * MB, 10000)).status).toBe(200);
  });

  it('rejects storage over-allocation when another ordinary member has a quota', async () => {
    mocks.member.findMany.mockResolvedValue([
      member, { userId: 'other', storageQuota: BigInt(4608 * MB), fileQuota: 0 },
    ]);
    const response = await setQuota(1024 * MB);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('存储空间超出团队总额');
    expect(mocks.member.update).not.toHaveBeenCalled();
  });

  it('rejects file over-allocation when another ordinary member has a quota', async () => {
    mocks.member.findMany.mockResolvedValue([
      member, { userId: 'other', storageQuota: null, fileQuota: 9500 },
    ]);
    const response = await setQuota(undefined, 1000);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('文件数量超出团队总额');
    expect(mocks.member.update).not.toHaveBeenCalled();
  });

  it('replaces the target member quota rather than adding it twice', async () => {
    mocks.member.findMany.mockResolvedValue([
      { ...member, storageQuota: BigInt(4096 * MB), fileQuota: 8000 },
      { userId: 'other', storageQuota: BigInt(1024 * MB), fileQuota: 2000 },
    ]);
    expect((await setQuota(4096 * MB, 8000)).status).toBe(200);
  });

  it('allows reducing a legacy over-allocated pool', async () => {
    mocks.member.findMany.mockResolvedValue([
      { ...member, storageQuota: BigInt(4096 * MB), fileQuota: 8000 },
      { userId: 'other', storageQuota: BigInt(4096 * MB), fileQuota: 8000 },
    ]);
    expect((await setQuota(2048 * MB, 4000)).status).toBe(200);
  });

  it.each([null, 0])('allows clearing quotas with %s', async (value) => {
    expect((await setQuota(value, value)).status).toBe(200);
    expect(mocks.member.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { storageQuota: value === null ? null : BigInt(0), fileQuota: value },
    }));
  });

  it.each([
    [-1, 100], [1.5, 100], [Number.MAX_SAFE_INTEGER + 1, 100],
    [MB, -1], [MB, 1.5], [MB, 2147483648],
  ])('rejects invalid quotas %s / %s before writing', async (storage, files) => {
    expect((await setQuota(storage, files)).status).toBe(400);
    expect(mocks.member.update).not.toHaveBeenCalled();
  });
});
