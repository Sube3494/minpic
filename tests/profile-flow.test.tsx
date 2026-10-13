import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProfileClient } from '@/app/profile/ProfileClient';
import { GET as getStats } from '@/app/api/user/stats/route';
import { serializeBigInt } from '@/lib/utils';
import { useQuota } from '@/hooks/use-quota';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  membership: vi.fn(),
}));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: async () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  config: { findMany: async () => [{ key: 'minio_personal' }], findUnique: async () => null },
  teamMember: { findUnique: mocks.membership },
  file: { aggregate: mocks.aggregate, count: async () => 2,
    groupBy: async () => [{ fileType: 'IMAGE', _count: 3 }] },
} }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'viewer' } }, update: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/components/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => children,
}));

const profile = {
  id: 'viewer', username: 'viewer', name: '测试用户', email: null,
  githubId: null, avatar: null, role: 'USER', status: 'ACTIVE',
  storageUsed: BigInt(3 * 1024 * 1024), storageQuota: BigInt(100 * 1024 * 1024),
  fileQuota: 100, fileCount: 3, createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'), lastLoginAt: null, githubLoginEnabled: true,
};

function setupResponses(role: 'OWNER' | 'MEMBER' | null) {
  const team = role ? {
    id: 'team', name: '测试团队', description: null,
    ownerId: role === 'OWNER' ? 'viewer' : 'other-owner',
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    storageQuota: BigInt(500 * 1024 * 1024), fileQuota: 1000,
    members: [{
      id: 'membership', teamId: 'team', userId: 'viewer', role: 'MEMBER',
      joinedAt: new Date('2026-01-01'), storageQuota: BigInt(100 * 1024 * 1024),
      fileQuota: 100, user: profile,
    }], owner: profile,
  } : null;
  mocks.membership.mockResolvedValue(team ? { team } : null);
  mocks.aggregate
    .mockResolvedValueOnce({ _count: 3, _sum: { fileSize: BigInt(3 * 1024 * 1024) } })
    .mockResolvedValueOnce({ _count: 1, _sum: { fileSize: BigInt(1024 * 1024) } })
    .mockResolvedValueOnce({ _count: 2, _sum: { fileSize: BigInt(2 * 1024 * 1024) } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/user/stats')) return getStats();
    if (url === '/api/user/profile') return new Response(JSON.stringify(serializeBigInt(profile, 'tagged')));
    if (url === '/api/teams') return new Response(JSON.stringify(serializeBigInt({ team, role }, 'tagged')));
    throw new Error(`Unexpected URL: ${url}`);
  }));
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Profile statistics API → page regression', () => {
  it.each(['OWNER', 'MEMBER', null] as const)('renders tagged storage statistics with role %s', async (role) => {
    setupResponses(role);
    render(<ProfileClient />);
    await screen.findByText('个人资料');
    if (role) await screen.findByText('测试团队');
    expect(screen.getByText('个人私有资源')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    if (role === 'MEMBER') expect(screen.getByText('2.0 MB / 100.0 MB')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('provides decimal strings to upload quota checks', async () => {
    setupResponses('MEMBER');
    const { result } = renderHook(() => useQuota());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quota?.storageUsed).toBe('3145728');
    expect(result.current.quota?.storageQuota).toBe('104857600');
    expect(Number(result.current.quota?.storageQuota)).toBe(100 * 1024 * 1024);
  });

  it('renders a new team with no uploaded files', async () => {
    setupResponses('OWNER');
    mocks.aggregate.mockReset().mockResolvedValue({ _count: 0, _sum: { fileSize: null } });
    render(<ProfileClient />);
    await screen.findByText('测试团队');
    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
