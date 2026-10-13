import { describe, expect, it } from 'vitest';
import { formatFileSize, serializeBigInt } from '@/lib/utils';
import { readApiResponse } from '@/lib/api-response';

describe('API and backup serialization contracts', () => {
  const large = BigInt('9007199254740993');
  const date = new Date('2026-01-01T00:00:00Z');
  const data = {
    storageUsed: BigInt(0), storageQuota: large, optionalQuota: null,
    files: [{ fileSize: large, createdAt: date, thumbnailData: Buffer.from([1, 2]) }],
  };

  it('returns exact decimal strings throughout nested API data', () => {
    const json = JSON.parse(JSON.stringify(serializeBigInt(data)));
    expect(json.storageUsed).toBe('0');
    expect(json.storageQuota).toBe('9007199254740993');
    expect(json.optionalQuota).toBeNull();
    expect(BigInt(json.files[0].fileSize)).toBe(large);
    expect(json.files[0].createdAt).toBe(date.toISOString());
    expect(json.files[0].thumbnailData).toEqual({ type: 'Buffer', data: [1, 2] });
  });

  it('retains BigInt type markers throughout backup data', () => {
    const json = JSON.parse(JSON.stringify(serializeBigInt(data, 'tagged')));
    expect(json.storageUsed).toEqual({ __bigint: '0' });
    expect(json.storageQuota).toEqual({ __bigint: '9007199254740993' });
    expect(BigInt(json.files[0].fileSize.__bigint)).toBe(large);
    expect(json.files[0].thumbnailData).toEqual({ type: 'Buffer', data: [1, 2] });
  });

  it.each(['string', 'tagged'] as const)('reads %s API responses without losing integer precision', async (format) => {
    const result = await readApiResponse<{ storageQuota: string; optionalQuota: null }>(
      new Response(JSON.stringify(serializeBigInt(data, format))),
    );
    expect(result.storageQuota).toBe('9007199254740993');
    expect(result.optionalQuota).toBeNull();
  });

  it('formats zero and nonzero decimal storage strings', () => {
    expect(formatFileSize('0')).toBe('0 B');
    expect(formatFileSize('1048576')).toBe('1.0 MB');
  });
});
