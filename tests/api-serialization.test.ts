import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getFiles } from '@/app/api/files/route';
import { GET as getFile } from '@/app/api/files/[id]/route';
import { GET as getStats } from '@/app/api/stats/route';
import { GET as getMembers, PATCH as updateRole } from '@/app/api/teams/members/route';
import { GET as getInvites } from '@/app/api/teams/invites/route';
import { GET as getProfile } from '@/app/api/user/profile/route';
import { GET as exportBackup } from '@/app/api/admin/backup/export/route';
import { decryptBackup } from '@/lib/backup-encryption';
import { fileService } from '@/services/file.service';
import { serializeBigInt } from '@/lib/utils';

const mocks = vi.hoisted(() => {
  const table = () => ({ findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() });
  return { prisma: {
    user: table(), account: table(), config: table(),
    team: table(), teamMember: table(), inviteCode: table(),
    collection: table(), collectionItem: table(), registrationWhitelist: table(),
    systemSettings: { findFirst: vi.fn() },
    file: { ...table(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  } };
});
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'owner', role: 'ADMIN' } }) }));
vi.mock('@/lib/auth-utils', () => ({
  requireAuth: async () => ({ error: null, user: { id: 'owner' } }),
}));
vi.mock('@/lib/settings', () => ({ getSystemSettings: async () => ({ githubLoginEnabled: true }) }));
vi.mock('@/lib/minio', () => ({ MinioService: class {} }));
vi.mock('@/lib/image-utils', () => ({}));
vi.mock('@/lib/team-quota', () => ({}));
vi.mock('@/lib/rate-limit', () => ({}));
vi.mock('@/lib/rate-limit-response', () => ({}));
vi.mock('@/lib/get-user-minio-config', () => ({ getUserMinioConfig: async () => ({ id: 'config' }) }));
vi.mock('@/lib/config-encryption', () => ({}));

const large = BigInt('9007199254740993');
const user = { id: 'owner', username: 'owner', name: null, email: null, avatar: null,
  storageUsed: large, fileCount: 1, createdAt: new Date('2026-01-01') };
const file = { id: 'file', userId: 'owner', filename: 'test.jpg', fileType: 'image',
  fileSize: large, thumbnailPath: null, createdAt: new Date('2026-01-01') };
const member = { id: 'member', userId: 'member-user', teamId: 'team', role: 'MEMBER',
  storageQuota: large, fileQuota: 100, joinedAt: new Date('2026-01-01'), user };

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('BigInt API serialization across features', () => {
  it('returns file list sizes that can be formatted and converted to BigInt', async () => {
    mocks.prisma.file.findMany.mockResolvedValue([file]);
    mocks.prisma.file.count.mockResolvedValue(1);
    const response = await getFiles(new NextRequest('http://localhost/api/files'));
    expect(response.status).toBe(200);
    vi.stubGlobal('fetch', vi.fn(async () => response));
    const result = await fileService.getFiles();
    expect(result.files[0].fileSize).toBe(large.toString());
    expect(result.pagination.total).toBe(1);
  });

  it('returns plain string sizes in file details', async () => {
    mocks.prisma.file.findUnique.mockResolvedValue(file);
    const response = await getFile(new NextRequest('http://localhost/api/files/file'), {
      params: Promise.resolve({ id: 'file' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).fileSize).toBe(large.toString());
  });

  it('returns plain strings in global totals and recent files', async () => {
    mocks.prisma.file.findMany.mockResolvedValue([file]);
    mocks.prisma.file.groupBy.mockResolvedValue([{ fileType: 'image', _count: 1 }]);
    mocks.prisma.file.aggregate.mockResolvedValue({ _sum: { fileSize: large } });
    const response = await getStats();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.totalSize).toBe(large.toString());
    expect(data.recentFiles[0].fileSize).toBe(large.toString());
  });

  it.each([true, false])('serializes member lists through the membership path: %s', async (hasMembership) => {
    const team = { id: 'team', ownerId: 'owner', members: [member] };
    mocks.prisma.teamMember.findUnique.mockResolvedValue(hasMembership ? { team } : null);
    mocks.prisma.team.findUnique.mockResolvedValue(team);
    const response = await getMembers();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.members[0].storageQuota).toBe(large.toString());
    expect(data.members[0].user.storageUsed).toBe(large.toString());
  });

  it('serializes quota fields when changing a member role', async () => {
    mocks.prisma.team.findUnique.mockResolvedValue({ id: 'team', ownerId: 'owner' });
    mocks.prisma.teamMember.findUnique.mockResolvedValue(member);
    mocks.prisma.teamMember.update.mockResolvedValue({ ...member, role: 'ADMIN' });
    const response = await updateRole(new NextRequest('http://localhost/api/teams/members?userId=member-user', {
      method: 'PATCH', body: JSON.stringify({ role: 'ADMIN' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).member.storageQuota).toBe(large.toString());
  });

  it('serializes member quotas included in invite history', async () => {
    mocks.prisma.team.findUnique.mockResolvedValue({ id: 'team', ownerId: 'owner' });
    mocks.prisma.inviteCode.findMany.mockResolvedValue([{ id: 'invite', members: [member] }]);
    const response = await getInvites();
    expect(response.status).toBe(200);
    expect((await response.json()).invites[0].members[0].storageQuota).toBe(large.toString());
  });

  it('returns decimal profile usage while preserving unallocated quotas', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ ...user });
    mocks.prisma.teamMember.findUnique.mockResolvedValue({ storageQuota: null, fileQuota: null });
    const response = await getProfile();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.storageUsed).toBe(large.toString());
    expect(data.storageQuota).toBeNull();
    expect(data.fileQuota).toBeNull();
  });

  it('reads old tagged responses for file lists and metadata updates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(
      serializeBigInt({ files: [file], pagination: { total: 1, totalPages: 1 } }, 'tagged'),
    ))));
    expect((await fileService.getFiles()).files[0].fileSize).toBe(large.toString());
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(serializeBigInt(file, 'tagged')))));
    expect((await fileService.patchFile('file', {})).fileSize).toBe(large.toString());
  });

  it('keeps backup BigInt markers inside the encrypted export', async () => {
    for (const table of Object.values(mocks.prisma)) {
      if ('findMany' in table) table.findMany.mockResolvedValue([]);
    }
    mocks.prisma.user.findMany.mockResolvedValue([user]);
    mocks.prisma.file.findMany.mockResolvedValue([{ ...file, thumbnailData: Buffer.from([1, 2]) }]);
    mocks.prisma.team.findMany.mockResolvedValue([{ storageQuota: large }]);
    mocks.prisma.teamMember.findMany.mockResolvedValue([member]);
    mocks.prisma.systemSettings.findFirst.mockResolvedValue(null);
    const response = await exportBackup(new NextRequest('http://localhost/api/admin/backup/export?pwd=test-password'));
    expect(response.status).toBe(200);
    const decrypted = JSON.parse(await decryptBackup(await response.json(), 'test-password'));
    expect(decrypted.backup.users[0].storageUsed).toEqual({ __bigint: large.toString() });
    expect(decrypted.backup.files[0].fileSize).toEqual({ __bigint: large.toString() });
    expect(decrypted.backup.files[0].thumbnailData).toEqual({ type: 'Buffer', data: [1, 2] });
    expect(decrypted.backup.teamMembers[0].storageQuota).toEqual({ __bigint: large.toString() });
  });
});
