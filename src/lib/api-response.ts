// Keep API BigInts as decimal strings so callers can use BigInt() without
// losing precision. Leave the server's tagged backup format unchanged.
export async function readApiResponse<T>(response: Response): Promise<T> {
  return JSON.parse(await response.text(), (_key, value) => {
    if (value && typeof value === 'object' && typeof value.__bigint === 'string') {
      return value.__bigint;
    }
    return value;
  });
}
