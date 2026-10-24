import { Hono } from 'hono';
import { Bindings } from '../types';
import { withPg } from '../db';

export const salesRoute = new Hono<{ Bindings: Bindings }>();

// 3. Buku Nota & Piutang Pelanggan (Sales & Receivables)
salesRoute.get('/sales', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  const dateRange = c.req.query('dateRange');
  const dateTo = c.req.query('dateTo');
  const status = c.req.query('status');
  try {
    const list = await withPg(dbUrl, async (client) => {
      const conditions: string[] = [];
      const values: string[] = [];

      if (dateRange) {
        const days = /^\d+$/.test(dateRange) ? Number(dateRange) : null;
        if (days !== null) {
          values.push(String(days));
          conditions.push(`date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - ($${values.length} || ' days')::interval`);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateRange)) {
          values.push(dateRange);
          conditions.push(`date >= $${values.length}::date`);
        }
      }
      if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        values.push(dateTo);
        conditions.push(`date <= $${values.length}::date`);
      }
      if (status && status.toLowerCase() !== 'semua' && status.toLowerCase() !== 'all') {
        const s = status.toUpperCase();
        if (s === 'LUNAS' || s === 'TEMPO') {
          values.push(s);
          conditions.push(`UPPER(COALESCE(payment_status, 'LUNAS')) = $${values.length}`);
        }
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await client.query(
        `
        SELECT
          id,
          COALESCE(invoice_no, '') as "invoiceNo",
          COALESCE(to_char(date, 'YYYY-MM-DD'), '') as date,
          COALESCE(buyer, 'Umum') as buyer,
          COALESCE(customer_type, 'B2C') as market,
          COALESCE(final_total, total_sell)::float8 as "totalAmount",
          COALESCE(total_buy, 0)::float8 as cogs,
          COALESCE(total_profit, 0)::float8 as profit,
          COALESCE(payment_method, 'Tunai / Kas') as "paymentMethod",
          UPPER(COALESCE(payment_status, 'LUNAS')) as "paymentStatus",
          items,
          to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') as time
        FROM transactions
        ${where}
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 100
      `,
        values
      );
      return res.rows.map((r: any) => ({
        ...r,
        time: r.time || '00:00',
        itemsCount: Array.isArray(r.items) ? r.items.length : 0,
      }));
    });
    return c.json(list);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

// 4. Riwayat Kulakan Supplier (Purchases)
salesRoute.get('/purchases', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const list = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        SELECT
          r.id,
          COALESCE(r.supplier_invoice_no, r.id) as "invoiceNo",
          COALESCE(r.date, '') as date,
          COALESCE(r.supplier, 'Umum') as supplier,
          COALESCE(r.total_buy, 0)::float8 as "totalBuy",
          COALESCE(i.item_count, 0)::int as "itemCount"
        FROM purchase_receipts r
        LEFT JOIN (
          SELECT receipt_id, COUNT(*) as item_count
          FROM purchase_receipt_items
          GROUP BY receipt_id
        ) i ON i.receipt_id = r.id
        ORDER BY r.date DESC NULLS LAST, r.id DESC
        LIMIT 50
      `);
      return res.rows.map((r: any) => ({ ...r }));
    });
    return c.json(list);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});
