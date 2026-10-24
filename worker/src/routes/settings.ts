import { Hono } from 'hono';
import { Bindings } from '../types';
import { withPg } from '../db';

export const settingsRoute = new Hono<{ Bindings: Bindings }>();

// 5. Test Connection
settingsRoute.post('/test-connection', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    await withPg(dbUrl, async (client) => {
      await client.query('SELECT 1');
    });
    return c.json({ success: true, message: 'Cloudflare Worker terhubung ke PostgreSQL' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 6. Profil Toko / Store Settings dari PostgreSQL (Exclude heavy binary/base64 logo)
settingsRoute.get('/settings', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const settings = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        SELECT key, value
        FROM store_settings
        WHERE key != 'store_logo'
      `);
      const map: Record<string, string> = {};
      for (const row of res.rows) {
        map[row.key] = row.value;
      }
      return map;
    });
    return c.json(settings);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});
