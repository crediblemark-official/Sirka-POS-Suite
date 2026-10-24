import { Hono } from 'hono';
import { Bindings } from '../types';
import { withPg } from '../db';

export const analyticsRoute = new Hono<{ Bindings: Bindings }>();

// 7. Intelijen Produk: Dead Stock, Modal Terkunci & Pareto
analyticsRoute.get('/analytics/products-intelligence', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const data = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        WITH item_sales AS (
          SELECT
            NULLIF(COALESCE(it.item->>'productId', it.item->>'code'), '') as product_id,
            SUM(CASE
              WHEN (it.item->>'baseQty') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (it.item->>'baseQty')::numeric
              WHEN (it.item->>'qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (it.item->>'qty')::numeric ELSE 0 END) as sold_qty,
            SUM(CASE WHEN (it.item->>'subtotalSell') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'subtotalSell')::numeric
                     WHEN (it.item->>'subtotal') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'subtotal')::numeric ELSE 0 END) as revenue,
            SUM(CASE WHEN (it.item->>'profit') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'profit')::numeric ELSE 0 END) as profit
          FROM transactions t
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END
          ) AS it(item)
          WHERE t.date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
          GROUP BY NULLIF(COALESCE(it.item->>'productId', it.item->>'code'), '')
        )
        SELECT
          p.id, p.code, p.name, p.category, p.unit,
          p.stock::float8,
          p.last_buy_price::float8 as "buyPrice",
          p.last_sell_price::float8 as "sellPrice",
          (p.stock * p.last_buy_price)::float8 as "capitalLocked",
          COALESCE(s.sold_qty, 0)::float8 as "sold30d",
          COALESCE(s.revenue, 0)::float8 as "revenue30d",
          COALESCE(s.profit, 0)::float8 as "profit30d",
          CASE
            WHEN p.last_sell_price > 0 THEN (((p.last_sell_price - p.last_buy_price) / p.last_sell_price) * 100)::float8
            ELSE 0::float8
          END as "marginPct",
          CASE
            WHEN COALESCE(s.sold_qty, 0) = 0 AND p.stock > 0 THEN 'DEAD_STOCK'
            WHEN COALESCE(s.sold_qty, 0) >= 10 THEN 'FAST_MOVING'
            ELSE 'SLOW_MOVING'
          END as "velocityStatus"
        FROM products p
        LEFT JOIN item_sales s ON p.id = s.product_id
        ORDER BY (p.stock * p.last_buy_price) DESC
        LIMIT 500
      `);

      let totalCapitalLocked = 0;
      let totalDeadStockSkus = 0;
      let fastMovingSkus = 0;

      for (const row of res.rows) {
        if (row.velocityStatus === 'DEAD_STOCK') {
          totalCapitalLocked += row.capitalLocked || 0;
          totalDeadStockSkus += 1;
        } else if (row.velocityStatus === 'FAST_MOVING') {
          fastMovingSkus += 1;
        }
      }

      return {
        totalCapitalLocked,
        totalDeadStockSkus,
        fastMovingSkus,
        items: res.rows,
      };
    });
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

// 8. Pola Penjualan & Jam Sibuk (Peak Hours & AOV Analytics)
analyticsRoute.get('/analytics/sales-patterns', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const data = await withPg(dbUrl, async (client) => {
      const hourlyRes = await client.query(`
        SELECT 
          EXTRACT(HOUR FROM COALESCE(created_at, NOW()) AT TIME ZONE 'Asia/Jakarta')::int as hour,
          COUNT(*)::int as "txCount",
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as revenue,
          COALESCE(AVG(COALESCE(final_total, total_sell)), 0)::float8 as aov
        FROM transactions
        WHERE date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM COALESCE(created_at, NOW()) AT TIME ZONE 'Asia/Jakarta')
        ORDER BY hour ASC
      `);

      const dowRes = await client.query(`
        SELECT 
          TO_CHAR(date, 'Dy') as "dayName",
          EXTRACT(DOW FROM date)::int as dow,
          COUNT(*)::int as "txCount",
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as revenue
        FROM transactions
        WHERE date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
        GROUP BY TO_CHAR(date, 'Dy'), EXTRACT(DOW FROM date)
        ORDER BY dow ASC
      `);

      const summaryRes = await client.query(`
        SELECT 
          COUNT(*)::int as "totalTransactions",
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as "totalSales",
          COALESCE(AVG(COALESCE(final_total, total_sell)), 0)::float8 as "averageTicket"
        FROM transactions
        WHERE date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
      `);
      const s = summaryRes.rows[0] || {};

      return {
        totalTransactions: parseInt(s.totalTransactions, 10) || 0,
        totalSales: parseFloat(s.totalSales) || 0,
        averageTicket: parseFloat(s.averageTicket) || 0,
        hourly: hourlyRes.rows,
        days: dowRes.rows,
      };
    });
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

// 9. Aging Schedule Piutang Bertingkat (Overdue Receivables)
analyticsRoute.get('/analytics/receivables-aging', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const data = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        SELECT 
          id,
          COALESCE(invoice_no, id) as "invoiceNo",
          COALESCE(buyer, 'Umum') as buyer,
          COALESCE(to_char(date, 'YYYY-MM-DD'), '') as date,
          COALESCE(final_total, total_sell)::float8 as amount,
          GREATEST(0, ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date))::int as "ageDays",
          CASE 
            WHEN ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date) <= 7 THEN '0_7_DAYS'
            WHEN ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date) <= 14 THEN '8_14_DAYS'
            WHEN ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date) <= 30 THEN '15_30_DAYS'
            ELSE 'OVER_30_DAYS'
          END as "agingBucket"
        FROM transactions
        WHERE UPPER(COALESCE(payment_status, 'LUNAS')) IN ('TEMPO', 'BELUM LUNAS', 'UNPAID')
        ORDER BY date ASC
        LIMIT 1000
      `);

      let bucket0_7 = 0;
      let bucket8_14 = 0;
      let bucket15_30 = 0;
      let bucketOver30 = 0;
      let totalPending = 0;

      for (const row of res.rows) {
        const amt = row.amount || 0;
        totalPending += amt;
        if (row.agingBucket === '0_7_DAYS') bucket0_7 += amt;
        else if (row.agingBucket === '8_14_DAYS') bucket8_14 += amt;
        else if (row.agingBucket === '15_30_DAYS') bucket15_30 += amt;
        else if (row.agingBucket === 'OVER_30_DAYS') bucketOver30 += amt;
      }

      return {
        totalPending,
        totalInvoices: res.rows.length,
        bucket0_7,
        bucket8_14,
        bucket15_30,
        bucketOver30,
        items: res.rows,
      };
    });
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});
