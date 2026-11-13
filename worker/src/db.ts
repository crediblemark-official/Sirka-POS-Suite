import { Client } from 'pg';

/**
 * Helper to query PostgreSQL
 *
 * BUG FIX: `DATABASE_URL` yang kosong menghasilkan error koneksi yang membingungkan.
 * Sekarang dicek lebih awal dengan pesan yang jelas.
 */
export async function withPg<T>(dbUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  if (!dbUrl || !dbUrl.trim()) {
    throw new Error(
      'DATABASE_URL belum dikonfigurasi. Jalankan `wrangler secret put DATABASE_URL` ' +
      'atau buat file .dev.vars untuk pengembangan lokal.'
    );
  }
  const lower = dbUrl.toLowerCase();
  const isLocal = lower.includes('localhost') || lower.includes('127.0.0.1');
  const disableSsl = lower.includes('sslmode=disable') || (isLocal && !lower.includes('sslmode=require'));
  const client = new Client({
    connectionString: dbUrl,
    ssl: disableSsl ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
