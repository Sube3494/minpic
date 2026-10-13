import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/config/minio/route';
import { getAccessibleMinioConfigs, getUserMinioConfig } from '@/lib/get-user-minio-config';
import { DEFAULT_MINIO_CONFIG } from '@/types/config';
import { ConfigEditor } from '@/components/settings/config-editor';
import { TooltipProvider } from '@/components/ui/tooltip';

const state = vi.hoisted(() => ({
  currentUser: 'owner',
  records: [] as Array<{ userId: string; key: string; value: string }>,
  create: vi.fn(),
  deleteMany: vi.fn(),
}));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: async () => ({ user: { id: state.currentUser } }) }));
vi.mock('@/lib/config-encryption', () => ({
  encryptMinioConfig: (config: unknown) => config, decryptMinioConfig: (config: unknown) => config,
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  config: {
    findMany: async ({ where }: { where: { userId: string; NOT?: { key: { in: string[] } } } }) =>
      state.records.filter(record => record.userId === where.userId && !where.NOT?.key.in.includes(record.key)),
    findUnique: async ({ where }: { where: { userId_key: { userId: string; key: string } } }) =>
      state.records.find(record => record.userId === where.userId_key.userId && record.key === where.userId_key.key) ?? null,
    create: state.create, deleteMany: state.deleteMany,
  },
  teamMember: {
    findUnique: async ({ where }: { where: { userId: string } }) => where.userId === 'outsider' ? null : {
      userId: where.userId, team: { ownerId: 'owner', name: '测试团队' },
    },
  },
} }));

function node(id: string, sharedWithTeam?: boolean) {
  const config = { ...DEFAULT_MINIO_CONFIG, id, name: id, endpoint: 'storage.example',
    bucket: 'bucket', accessKey: 'test', secretKey: 'test', sharedWithTeam };
  return config;
}
function store(userId: string, id: string, sharedWithTeam?: boolean) {
  state.records.push({ userId, key: `minio_${id}`, value: JSON.stringify(node(id, sharedWithTeam)) });
}
function active(userId: string, id: string) {
  state.records.push({ userId, key: 'minio_active_id', value: id });
}
function save(configs: unknown[], activeId?: string) {
  return POST(new NextRequest('http://localhost/api/config/minio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configs, activeId }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.currentUser = 'owner'; state.records = [];
  store('owner', 'private', false); store('owner', 'shared', true); store('owner', 'legacy');
  store('member', 'personal', false); active('owner', 'private'); active('member', 'shared');
  state.create.mockImplementation(async ({ data }) => { state.records.push(data); return data; });
  state.deleteMany.mockImplementation(async ({ where }) => {
    state.records = state.records.filter(record => record.userId !== where.userId); return { count: 1 };
  });
});
afterEach(cleanup);

describe('Selectable team storage nodes', () => {
  it('lists only shared owner nodes plus the member personal nodes', async () => {
    state.currentUser = 'member';
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.configs.map((config: { id: string }) => config.id)).toEqual(['shared', 'legacy', 'personal']);
    expect(data.activeId).toBe('shared');
    expect(data.configs[0]).toMatchObject({ isTeam: true, teamName: '测试团队' });
    expect(data.configs[2].isTeam).toBe(false);
  });

  it('lets the owner use all nodes without recursively resolving their own team', async () => {
    expect((await getAccessibleMinioConfigs('owner')).map(config => config.id)).toEqual(['private', 'shared', 'legacy']);
    expect((await getUserMinioConfig('owner', 'private'))?.id).toBe('private');
  });

  it('resolves the selected shared node rather than the owner private active node', async () => {
    expect((await getUserMinioConfig('member', 'shared'))?.id).toBe('shared');
    expect((await getUserMinioConfig('member'))?.id).toBe('shared');
  });

  it.each(['private', 'missing'])('rejects the inaccessible explicit node %s without falling back', async (id) => {
    expect(await getUserMinioConfig('member', id)).toBeNull();
  });

  it('never grants outsiders access to owner nodes', async () => {
    expect(await getUserMinioConfig('outsider', 'shared')).toBeNull();
  });

  it('persists the owner sharing toggle and immediately revokes member access', async () => {
    expect((await getUserMinioConfig('member', 'shared'))?.id).toBe('shared');
    expect((await save([node('private', false), node('shared', false), node('legacy')], 'private')).status).toBe(200);
    expect(await getUserMinioConfig('member', 'shared')).toBeNull();
    state.currentUser = 'member';
    const data = await (await GET()).json();
    expect(data.configs.map((config: { id: string }) => config.id)).toEqual(['legacy', 'personal']);
    expect(data.activeId).toBe('legacy');
  });

  it('rejects activating a revoked shared node before changing member settings', async () => {
    state.currentUser = 'member';
    const response = await save([{ ...node('private', true), isTeam: true }, node('personal', false)], 'private');
    expect(response.status).toBe(403);
    expect(state.deleteMany).not.toHaveBeenCalled();
  });

  it('saves only member-owned nodes and retains shared-node selection', async () => {
    state.currentUser = 'member';
    expect((await save([{ ...node('shared', true), isTeam: true }, node('personal', false)], 'shared')).status).toBe(200);
    expect(state.records.filter(record => record.userId === 'member').map(record => record.key))
      .toEqual(['minio_personal', 'minio_active_id']);
    expect((await getUserMinioConfig('member'))?.id).toBe('shared');
  });

  it('rejects malformed sharing flags before writing', async () => {
    expect((await save([{ ...node('shared'), sharedWithTeam: 'false' }])).status).toBe(400);
    expect(state.deleteMany).not.toHaveBeenCalled();
  });

  it('defaults new nodes to private', () => {
    expect(DEFAULT_MINIO_CONFIG.sharedWithTeam).toBe(false);
  });

  it('allows changing sharing in the node editor', () => {
    const onUpdate = vi.fn();
    render(<TooltipProvider><ConfigEditor config={node('private', false)} isSyncing={false}
      isTesting={false} isSaving={false} onUpdate={onUpdate} onSync={vi.fn()}
      onTest={vi.fn()} onSave={vi.fn()} /></TooltipProvider>);
    const toggle = screen.getByRole('switch', { name: '共享给团队' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onUpdate).toHaveBeenCalledWith({ sharedWithTeam: true });
  });

  it('keeps shared team nodes read-only for members', () => {
    render(<TooltipProvider><ConfigEditor config={{ ...node('shared', true), isTeam: true }}
      canEdit={false} isSyncing={false} isTesting={false} isSaving={false}
      onUpdate={vi.fn()} onSync={vi.fn()} onTest={vi.fn()} onSave={vi.fn()} /></TooltipProvider>);
    expect(screen.queryByRole('switch', { name: '共享给团队' })).not.toBeInTheDocument();
  });
});
