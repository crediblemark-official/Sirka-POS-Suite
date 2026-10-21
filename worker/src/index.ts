import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Client } from 'pg';

type Bindings = {
  DATABASE_URL: string;
  APP_NAME?: string;
  OWNER_SECRET_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for mobile app
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-owner-pin'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// Helper to query PostgreSQL
async function withPg<T>(dbUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: dbUrl,
    ssl: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: c.env.APP_NAME || 'Sirka Owner API',
    timestamp: new Date().toISOString(),
  });
});

// 1. Laporan Laba Rugi & Arus Kas (Income Statement & Cash Flow)
app.get('/api/financial-report', async (c) => {
  const period = c.req.query('period') || 'month';
  const dbUrl = c.env.DATABASE_URL;

  let txDateFilter = "date >= date_trunc('month', CURRENT_DATE)";
  let purDateFilter = "date >= to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')";
  let periodLabel = 'Bulan Berjalan';

  if (period === 'today') {
    txDateFilter = "date = CURRENT_DATE";
    purDateFilter = "date = to_char(CURRENT_DATE, 'YYYY-MM-DD')";
    periodLabel = 'Hari Ini';
  } else if (period === 'week') {
    txDateFilter = "date >= CURRENT_DATE - INTERVAL '7 days'";
    purDateFilter = "date >= to_char(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')";
    periodLabel = '7 Hari Terakhir';
  } else if (period === 'year') {
    txDateFilter = "date >= date_trunc('year', CURRENT_DATE)";
    purDateFilter = "date >= to_char(date_trunc('year', CURRENT_DATE), 'YYYY-MM-DD')";
    periodLabel = 'Tahun Ini';
  }

  try {
    const data = await withPg(dbUrl, async (client) => {
      // Query transactions (P&L & Cash Flow)
      const txRes = await client.query(`
        SELECT 
          COALESCE(SUM(total_sell), 0)::float8 as gross_sales,
          COALESCE(SUM(COALESCE(discount_amount, 0)), 0)::float8 as discounts,
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as net_sales,
          COALESCE(SUM(total_buy), 0)::float8 as cogs,
          COALESCE(SUM(total_profit), 0)::float8 as gross_profit,
          COALESCE(SUM(CASE WHEN payment_method = 'Tunai' THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as cash_in,
          COALESCE(SUM(CASE WHEN payment_method != 'Tunai' AND payment_status = 'Lunas' THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as transfer_in,
          COUNT(*)::int8 as tx_count
        FROM transactions
        WHERE ${txDateFilter}
      `);
      const r = txRes.rows[0];

      const grossSales = parseFloat(r.gross_sales) || 0;
      const discounts = parseFloat(r.discounts) || 0;
      const netSales = parseFloat(r.net_sales) || 0;
      const cogs = parseFloat(r.cogs) || 0;
      const grossProfit = parseFloat(r.gross_profit) || 0;
      const cashInflow = parseFloat(r.cash_in) || 0;
      const transferInflow = parseFloat(r.transfer_in) || 0;
      const totalTransactions = parseInt(r.tx_count, 10) || 0;

      const profitMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
      const averageTicketSize = totalTransactions > 0 ? netSales / totalTransactions : 0;

      // Pending receivables (Tempo)
      const recRes = await client.query(`
        SELECT COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as pending
        FROM transactions
        WHERE payment_status = 'Tempo' OR payment_status = 'Belum Lunas'
      `);
      const pendingReceivables = parseFloat(recRes.rows[0].pending) || 0;

      // Inventory asset value (Stok × Harga Beli HPP)
      const invRes = await client.query(`
        SELECT COALESCE(SUM(stock * last_buy_price), 0)::float8 as inv_val
        FROM products
      `);
      const inventoryAssetValue = parseFloat(invRes.rows[0].inv_val) || 0;

      // Purchases
      const purRes = await client.query(`
        SELECT COALESCE(SUM(total_buy), 0)::float8 as pur_val
        FROM purchase_receipts
        WHERE ${purDateFilter}
      `);
      const cashOutflowPurchases = parseFloat(purRes.rows[0]?.pur_val) || 0;
      const netCashFlow = (cashInflow + transferInflow) - cashOutflowPurchases;

      return {
        periodLabel,
        grossSales,
        discounts,
        netSales,
        cogs,
        grossProfit,
        profitMarginPercent,
        cashInflow,
        transferInflow,
        cashOutflowPurchases,
        netCashFlow,
        pendingReceivables,
        inventoryAssetValue,
        totalTransactions,
        averageTicketSize,
      };
    });

    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

// 2. Valuasi Aset Persediaan Barang (Inventory Valuation)
app.get('/api/inventory-valuation', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const items = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        SELECT 
          id, 
          code, 
          name, 
          category, 
          stock::float8, 
          unit, 
          last_buy_price::float8 as "buyPrice", 
          last_sell_price::float8 as "sellPrice",
          (stock * last_buy_price)::float8 as "assetValue"
        FROM products
        ORDER BY (stock * last_buy_price) DESC
        LIMIT 150
      `);
      return res.rows;
    });
    return c.json(items);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

// 3. Buku Nota & Piutang Pelanggan (Sales & Receivables)
app.get('/api/sales', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const list = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        SELECT 
          id,
          COALESCE(invoice_no, '') as "invoiceNo",
          COALESCE(to_char(date, 'YYYY-MM-DD'), '') as date,
          COALESCE(buyer, 'Umum') as buyer,
          COALESCE(customer_type, 'B2C') as market,
          COALESCE(final_total, total_sell)::float8 as "totalAmount",
          COALESCE(total_buy, 0)::float8 as cogs,
          COALESCE(total_profit, 0)::float8 as profit,
          COALESCE(payment_method, 'Tunai') as "paymentMethod",
          COALESCE(payment_status, 'Lunas') as "paymentStatus",
          items,
          to_char(created_at, 'HH24:MI') as time
        FROM transactions
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 100
      `);
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
app.get('/api/purchases', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const list = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        SELECT 
          id,
          COALESCE(supplier_invoice_no, id) as "invoiceNo",
          COALESCE(date, '') as date,
          COALESCE(supplier, 'Umum') as supplier,
          COALESCE(total_buy, 0)::float8 as "totalBuy"
        FROM purchase_receipts
        ORDER BY date DESC NULLS LAST, id DESC
        LIMIT 50
      `);
      return res.rows.map((r: any) => ({ ...r, itemCount: 0 }));
    });
    return c.json(list);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

// 5. Test Connection
app.post('/api/test-connection', async (c) => {
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
app.get('/api/settings', async (c) => {
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

// 7. Intelijen Produk: Dead Stock, Modal Terkunci & Pareto
app.get('/api/analytics/products-intelligence', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const data = await withPg(dbUrl, async (client) => {
      const res = await client.query(`
        WITH item_sales AS (
          SELECT 
            COALESCE(it.item->>'code', it.item->>'productId', '') as code,
            SUM(CASE WHEN (it.item->>'qty') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'qty')::numeric ELSE 0 END) as sold_qty,
            SUM(CASE WHEN (it.item->>'subtotalSell') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'subtotalSell')::numeric 
                     WHEN (it.item->>'subtotal') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'subtotal')::numeric ELSE 0 END) as revenue,
            SUM(CASE WHEN (it.item->>'profit') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'profit')::numeric ELSE 0 END) as profit
          FROM transactions t
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END
          ) AS it(item)
          WHERE t.date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY COALESCE(it.item->>'code', it.item->>'productId', '')
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
        LEFT JOIN item_sales s ON p.code = s.code OR p.id = s.code
        ORDER BY (p.stock * p.last_buy_price) DESC
        LIMIT 200
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
app.get('/api/analytics/sales-patterns', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const data = await withPg(dbUrl, async (client) => {
      // Hourly distribution
      const hourlyRes = await client.query(`
        SELECT 
          EXTRACT(HOUR FROM COALESCE(created_at, NOW()))::int as hour,
          COUNT(*)::int as "txCount",
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as revenue,
          COALESCE(AVG(COALESCE(final_total, total_sell)), 0)::float8 as aov
        FROM transactions
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM COALESCE(created_at, NOW()))
        ORDER BY hour ASC
      `);

      // Day of week distribution
      const dowRes = await client.query(`
        SELECT 
          TO_CHAR(date, 'Dy') as "dayName",
          EXTRACT(DOW FROM date)::int as dow,
          COUNT(*)::int as "txCount",
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as revenue
        FROM transactions
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY TO_CHAR(date, 'Dy'), EXTRACT(DOW FROM date)
        ORDER BY dow ASC
      `);

      // Summary averages
      const summaryRes = await client.query(`
        SELECT 
          COUNT(*)::int as "totalTransactions",
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as "totalSales",
          COALESCE(AVG(COALESCE(final_total, total_sell)), 0)::float8 as "averageTicket"
        FROM transactions
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
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
app.get('/api/analytics/receivables-aging', async (c) => {
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
          GREATEST(0, (CURRENT_DATE - date))::int as "ageDays",
          CASE 
            WHEN (CURRENT_DATE - date) <= 7 THEN '0_7_DAYS'
            WHEN (CURRENT_DATE - date) <= 14 THEN '8_14_DAYS'
            WHEN (CURRENT_DATE - date) <= 30 THEN '15_30_DAYS'
            ELSE 'OVER_30_DAYS'
          END as "agingBucket"
        FROM transactions
        WHERE payment_status = 'Tempo' OR payment_status = 'Belum Lunas'
        ORDER BY date ASC
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

// 10. Pergantian Shift Kasir & Rekonsiliasi Kas (Cashier Shifts)
app.get('/api/shifts', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const list = await withPg(dbUrl, async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS cashier_shifts (
          id VARCHAR(50) PRIMARY KEY,
          cashier_name VARCHAR(100) NOT NULL,
          start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          end_time TIMESTAMPTZ,
          starting_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
          non_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
          cash_outflow NUMERIC(15,2) NOT NULL DEFAULT 0,
          expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          actual_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          discrepancy NUMERIC(15,2) NOT NULL DEFAULT 0,
          notes TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      const res = await client.query(`
        SELECT 
          id,
          cashier_name as "cashierName",
          to_char(start_time, 'YYYY-MM-DD HH24:MI') as "startTime",
          to_char(end_time, 'YYYY-MM-DD HH24:MI') as "endTime",
          starting_cash::float8 as "startingCash",
          cash_sales::float8 as "cashSales",
          non_cash_sales::float8 as "nonCashSales",
          cash_outflow::float8 as "cashOutflow",
          expected_cash::float8 as "expectedCash",
          actual_cash::float8 as "actualCash",
          discrepancy::float8 as discrepancy,
          notes,
          status
        FROM cashier_shifts
        ORDER BY start_time DESC
        LIMIT 50
      `);
      return res.rows;
    });
    return c.json(list);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database query error' }, 500);
  }
});

app.post('/api/shifts', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  const body = await c.req.json();
  try {
    const saved = await withPg(dbUrl, async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS cashier_shifts (
          id VARCHAR(50) PRIMARY KEY,
          cashier_name VARCHAR(100) NOT NULL,
          start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          end_time TIMESTAMPTZ,
          starting_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
          non_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
          cash_outflow NUMERIC(15,2) NOT NULL DEFAULT 0,
          expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          actual_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          discrepancy NUMERIC(15,2) NOT NULL DEFAULT 0,
          notes TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      const id = body.id || `shift-${Date.now()}`;
      await client.query(`
        INSERT INTO cashier_shifts (
          id, cashier_name, start_time, end_time, starting_cash, cash_sales,
          non_cash_sales, cash_outflow, expected_cash, actual_cash, discrepancy,
          notes, status, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          cash_sales = EXCLUDED.cash_sales,
          non_cash_sales = EXCLUDED.non_cash_sales,
          cash_outflow = EXCLUDED.cash_outflow,
          expected_cash = EXCLUDED.expected_cash,
          actual_cash = EXCLUDED.actual_cash,
          discrepancy = EXCLUDED.discrepancy,
          notes = EXCLUDED.notes,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [
        id,
        body.cashierName || 'Kasir',
        body.startTime || new Date(),
        body.endTime || null,
        body.startingCash || 0,
        body.cashSales || 0,
        body.nonCashSales || 0,
        body.cashOutflow || 0,
        body.expectedCash || 0,
        body.actualCash || 0,
        body.discrepancy || 0,
        body.notes || '',
        body.status || 'OPEN',
      ]);
      return { success: true, id };
    });
    return c.json(saved);
  } catch (error: any) {
    return c.json({ error: error.message || 'Database save error' }, 500);
  }
});

export default app;
