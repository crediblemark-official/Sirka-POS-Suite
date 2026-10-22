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

/**
 * BUG FIX (keamanan): `OWNER_SECRET_KEY` sebelumnya DIDEKLARASIKAN tapi tidak
 * pernah dipakai — sehingga seluruh data keuangan toko (omzet, nama pelanggan,
 * piutang) terbuka untuk siapa pun yang mengetahui URL Worker. Klaim
 * "proteksi token" di README tidak pernah ada.
 *
 * Sekarang token DITEGAKAN:
 * - Bila `OWNER_SECRET_KEY` diset → semua endpoint `/api/*` WAJIB mengirim
 *   header `Authorization: Bearer <token>` (atau `x-owner-pin`).
 * - Bila `OWNER_SECRET_KEY` TIDAK diset → proteksi dimatikan (mode dev),
 *   dan aplikasi mobile menampilkan peringatan.
 *
 * Perbandingan token memakai constant-time comparison supaya tidak bisa
 * ditebak dengan timing attack.
 */
app.use('/api/*', async (c, next) => {
  const expected = c.env.OWNER_SECRET_KEY;
  if (!expected || !expected.trim()) {
    // Proteksi dimatikan (mode pengembangan). Endpoint tetap berjalan.
    return next();
  }

  const authHeader = c.req.header('Authorization') || '';
  const pinHeader = c.req.header('x-owner-pin') || '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : pinHeader.trim();

  if (!provided || !constantTimeEquals(provided, expected.trim())) {
    return c.json(
      {
        error: 'Unauthorized. Endpoint ini memerlukan token akses yang valid.',
        hint: 'Kirim header "Authorization: Bearer <OWNER_SECRET_KEY>".',
      },
      401
    );
  }

  return next();
});

/** Perbandingan string constant-time (mencegah timing attack). */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Tetap lakukan perbandingan agar durasi tidak bocor lewat panjang.
    let diff = 1;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ (i < b.length ? b.charCodeAt(i) : 0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Helper to query PostgreSQL
 *
 * BUG FIX: `DATABASE_URL` yang kosong menghasilkan error koneksi yang membingungkan.
 * Sekarang dicek lebih awal dengan pesan yang jelas.
 */
async function withPg<T>(dbUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  if (!dbUrl || !dbUrl.trim()) {
    throw new Error(
      'DATABASE_URL belum dikonfigurasi. Jalankan `wrangler secret put DATABASE_URL` ' +
      'atau buat file .dev.vars untuk pengembangan lokal.'
    );
  }
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

// Health check (publik — dipakai monitoring; tidak berisi data sensitif)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: c.env.APP_NAME || 'Sirka Owner API',
    // BUG FIX: aplikasi mobile perlu tahu apakah proteksi token aktif supaya
    // bisa menampilkan peringatan bila endpoint masih terbuka.
    authEnabled: Boolean(c.env.OWNER_SECRET_KEY && c.env.OWNER_SECRET_KEY.trim()),
    timestamp: new Date().toISOString(),
  });
});

// 1. Laporan Laba Rugi & Arus Kas (Income Statement & Cash Flow)
app.get('/api/financial-report', async (c) => {
  const period = c.req.query('period') || 'month';
  const dbUrl = c.env.DATABASE_URL;

  /**
   * BUG FIX (konsistensi periode & timezone):
   *
   * 1) `CURRENT_DATE` dievaluasi memakai zona waktu SERVER PostgreSQL (biasanya
   *    UTC). Toko beroperasi WIB (UTC+7) sehingga antara pukul 00:00-07:00 WIB
   *    laporan "Hari Ini" menampilkan data KEMARIN. Sekarang semua batas
   *    periode dihitung dari zona waktu toko ('Asia/Jakarta').
   *
   * 2) Definisi periode sebelumnya berbeda dari aplikasi desktop:
   *    - 'month': worker = bulan BERJALAN, desktop = awal bulan SEBELUM s/d hari ini
   *    - 'year' : worker = awal tahun INI, desktop = tanggal sama tahun LALU
   *    Akibatnya omzet untuk tombol yang sama berbeda antara HP dan PC.
   *    Sekarang keduanya memakai definisi yang sama (rolling).
   *
   * 3) Label "7 Hari Terakhir" sebenarnya mencakup 8 hari kalender.
   */
  const TZ = "'Asia/Jakarta'";
  let txDateFilter = `(date >= (date_trunc('month', NOW() AT TIME ZONE ${TZ})::date - INTERVAL '1 month')
                       AND date <= (NOW() AT TIME ZONE ${TZ})::date)`;
  let purDateFilter = `(date >= to_char((date_trunc('month', NOW() AT TIME ZONE ${TZ})::date - INTERVAL '1 month'), 'YYYY-MM-DD')
                        AND date <= to_char((NOW() AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD'))`;
  // BUG FIX: label sebelumnya '30 Hari Terakhir' padahal window-nya adalah
  // 'awal bulan sebelumnya s/d hari ini' (30-61 hari). Label diperbaiki.
  let periodLabel = 'Bulan Berjalan + Bulan Sebelumnya';

  if (period === 'today') {
    txDateFilter = `date = (NOW() AT TIME ZONE ${TZ})::date`;
    purDateFilter = `date = to_char((NOW() AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`;
    periodLabel = 'Hari Ini';
  } else if (period === 'week') {
    txDateFilter = `date >= (NOW() AT TIME ZONE ${TZ})::date - INTERVAL '7 days'`;
    purDateFilter = `date >= to_char((NOW() AT TIME ZONE ${TZ})::date - INTERVAL '7 days', 'YYYY-MM-DD')`;
    periodLabel = '8 Hari Terakhir';
  } else if (period === 'year') {
    txDateFilter = `date >= ((NOW() AT TIME ZONE ${TZ})::date - INTERVAL '1 year')`;
    purDateFilter = `date >= to_char((NOW() AT TIME ZONE ${TZ})::date - INTERVAL '1 year', 'YYYY-MM-DD')`;
    periodLabel = '1 Tahun Terakhir';
  }

  try {
      const data = await withPg(dbUrl, async (client) => {
      // Query transactions (P&L & Cash Flow)
      // BUG FIX: nilai `payment_method` yang ditulis aplikasi adalah
      // 'Tunai / Kas' (bukan 'Tunai') dan `payment_status` adalah 'LUNAS'
      // (bukan 'Lunas'). Sebelumnya perbandingan case-sensitive sehingga
      // cash_in & transfer_in SELALU Rp 0 dan seluruh penjualan tunai masuk
      // ke bucket transfer. Perbandingan dinormalisasi dengan UPPER().
      // BUG FIX: `points_discount` ikut dijumlahkan ke diskon supaya
      // Gross - Diskon = Net (P&L harus balance).
      const txRes = await client.query(`
        SELECT
          COALESCE(SUM(total_sell), 0)::float8 as gross_sales,
          COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(points_discount, 0)), 0)::float8 as discounts,
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as net_sales,
          COALESCE(SUM(total_buy), 0)::float8 as cogs,
          COALESCE(SUM(total_profit), 0)::float8 as gross_profit,
          COALESCE(SUM(CASE
            WHEN UPPER(payment_method) IN ('TUNAI', 'TUNAI / KAS', 'CASH')
                 AND UPPER(COALESCE(payment_status, 'LUNAS')) = 'LUNAS'
            THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as cash_in,
          -- BUG FIX: 'Nota Tempo' sebelumnya dikeluarkan dari KEDUA bucket
          -- sehingga tidak masuk ke mana pun -> "Total Kas Masuk" kurang dari
          -- nilai sebenarnya & berbeda dari versi desktop (yang menghitungnya
          -- sebagai non-tunai). Sekarang 'Nota Tempo' masuk bucket non-tunai.
          COALESCE(SUM(CASE
            WHEN UPPER(payment_method) NOT IN ('TUNAI', 'TUNAI / KAS', 'CASH')
                 AND UPPER(COALESCE(payment_status, 'LUNAS')) = 'LUNAS'
            THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as transfer_in,
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
      // BUG FIX: nilai di database adalah 'TEMPO' (upper case). Perbandingan
      // 'Tempo' tidak pernah cocok -> total piutang selalu Rp 0 dan modul
      // aging piutang kosong total.
      const recRes = await client.query(`
        SELECT COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as pending
        FROM transactions
        WHERE UPPER(COALESCE(payment_status, 'LUNAS')) IN ('TEMPO', 'BELUM LUNAS', 'UNPAID')
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
  // BUG FIX: filter tanggal & status dari aplikasi mobile sebelumnya diabaikan
  // sehingga halaman "Penjualan" selalu menampilkan seluruh data.
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
          // BUG FIX: "rentang tanggal" sebelumnya hanya punya batas BAWAH
          // sehingga `dateRange=2026-10-01` berarti "dari 1 Okt sampai sekarang",
          // bukan "hanya 1 Okt". Sekarang batas atas bisa dikirim via `dateTo`.
          conditions.push(`date >= $${values.length}::date`);
        }
      }
      if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        values.push(dateTo);
        conditions.push(`date <= $${values.length}::date`);
      }
      if (status && status.toLowerCase() !== 'semua' && status.toLowerCase() !== 'all') {
        // BUG FIX: filter `status` apa pun selain "lunas" sebelumnya dipetakan
        // ke TEMPO. Jadi `status=Batal` atau `status=xyz` diam-diam berarti
        // "tampilkan yang TEMPO" — hasil yang tidak diminta.
        // Sekarang hanya LUNAS & TEMPO yang dikenali; nilai lain diabaikan.
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
          -- BUG FIX: normalisasi status bayar ke huruf kapital ('LUNAS'/'TEMPO')
          -- supaya konsisten dengan nilai yang ditulis aplikasi desktop dan
          -- dengan tipe di src/types/index.ts.
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
app.get('/api/purchases', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const list = await withPg(dbUrl, async (client) => {
      // BUG FIX: `itemCount` sebelumnya hard-coded 0 sehingga aplikasi mobile
      // selalu menampilkan "0 macam barang". Jumlah item diambil dari tabel
      // ternormalisasi `purchase_receipt_items`.
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
            -- BUG FIX (KRITIS): join di bawah memakai p.id = s.product_id,
            -- jadi CTE WAJIB menghasilkan productId. Sebelumnya CTE memilih
            -- kode lebih dulu -> kunci join tidak pernah cocok (0 baris) ->
            -- sold_qty selalu 0 -> SETIAP produk jadi DEAD_STOCK dan
            -- "Modal Terkunci" = seluruh nilai inventori.
            NULLIF(COALESCE(it.item->>'productId', it.item->>'code'), '') as product_id,
            -- BUG FIX: qty disimpan dalam SATUAN AKTIF (mis. 1 DUS = 40 PCS)
            -- sedangkan baseQty adalah satuan dasar. Menjumlahkan qty saja
            -- membuat "laris" membandingkan 1 DUS dengan 10 PCS sebagai sama.
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
          -- BUG FIX: ambang "FAST_MOVING" memakai satuan dasar (baseQty),
          -- sebelumnya memakai qty satuan aktif sehingga tidak konsisten.
          CASE
            WHEN COALESCE(s.sold_qty, 0) = 0 AND p.stock > 0 THEN 'DEAD_STOCK'
            WHEN COALESCE(s.sold_qty, 0) >= 10 THEN 'FAST_MOVING'
            ELSE 'SLOW_MOVING'
          END as "velocityStatus"
        FROM products p
        -- BUG FIX: join lama p.code = s.code OR p.id = s.code bukan kunci yang
        -- valid -> satu produk bisa TERDAFTAR DUA KALI (fan-out) sehingga
        -- modal terkunci & penjualan terhitung ganda. Sekarang join hanya pada
        -- productId yang sama.
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
app.get('/api/analytics/sales-patterns', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const data = await withPg(dbUrl, async (client) => {
      // Hourly distribution
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

      // Day of week distribution
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

      // Summary averages
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

/**
 * BUG FIX: endpoint READ (/api/shifts) sebelumnya menjalankan 5 statement DDL
 * (CREATE TABLE + 4x ALTER TABLE) pada SETIAP request. `ALTER TABLE ... ADD
 * COLUMN IF NOT EXISTS` mengambil lock ACCESS EXCLUSIVE pada tabel sehingga
 * memblokir penulisan shift dari aplikasi kasir — dan menambah 5 round-trip
 * per polling.
 *
 * Sekarang DDL hanya dijalankan SATU KALI per isolate (cache di level modul).
 */
let shiftsSchemaReady: Promise<void> | null = null;

async function ensureShiftsSchema(client: Client): Promise<void> {
  if (!shiftsSchemaReady) {
    shiftsSchemaReady = (async () => {
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
          cash_inflow NUMERIC(15,2) NOT NULL DEFAULT 0,
          refund_outflow NUMERIC(15,2) NOT NULL DEFAULT 0,
          transferred_to_treasury NUMERIC(15,2) NOT NULL DEFAULT 0,
          retained_in_drawer NUMERIC(15,2) NOT NULL DEFAULT 0,
          expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          actual_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          discrepancy NUMERIC(15,2) NOT NULL DEFAULT 0,
          notes TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        -- Migrasi idempotent untuk tabel yang sudah ada
        ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS cash_inflow NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS refund_outflow NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS transferred_to_treasury NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS retained_in_drawer NUMERIC(15,2) DEFAULT 0;
      `);
    })().catch((err) => {
      // Gagal -> coba lagi pada request berikutnya
      shiftsSchemaReady = null;
      throw err;
    });
  }
  return shiftsSchemaReady;
}

// 10. Pergantian Shift Kasir & Rekonsiliasi Kas (Cashier Shifts)
app.get('/api/shifts', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
    const list = await withPg(dbUrl, async (client) => {
      await ensureShiftsSchema(client);

      const res = await client.query(`
        SELECT
          id,
          cashier_name as "cashierName",
          to_char(start_time AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS') as "startTime",
          to_char(end_time AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS') as "endTime",
          starting_cash::float8 as "startingCash",
          cash_sales::float8 as "cashSales",
          non_cash_sales::float8 as "nonCashSales",
          cash_outflow::float8 as "cashOutflow",
          cash_inflow::float8 as "cashInflow",
          refund_outflow::float8 as "refundOutflow",
          transferred_to_treasury::float8 as "transferredToTreasury",
          retained_in_drawer::float8 as "retainedInDrawer",
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
  try {
    // BUG FIX: `c.req.json()` sebelumnya dipanggil DI LUAR try sehingga body
    // rusak melempar error di luar kontrak handler (respons 500 non-JSON).
    const body = await c.req.json();
    const saved = await withPg(dbUrl, async (client) => {
      await ensureShiftsSchema(client);

      const id = body.id || `shift-${Date.now()}`;
      await client.query(`
        INSERT INTO cashier_shifts (
          id, cashier_name, start_time, end_time, starting_cash, cash_sales,
          non_cash_sales, cash_outflow, cash_inflow, refund_outflow,
          transferred_to_treasury, retained_in_drawer, expected_cash, actual_cash, discrepancy,
          notes, status, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          -- BUG FIX: kolom cashier_name & start_time sebelumnya tidak pernah
          -- di-update sehingga tidak ada cara memperbaiki nama kasir atau
          -- waktu mulai shift yang keliru.
          cashier_name = EXCLUDED.cashier_name,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          cash_sales = EXCLUDED.cash_sales,
          non_cash_sales = EXCLUDED.non_cash_sales,
          cash_outflow = EXCLUDED.cash_outflow,
          cash_inflow = EXCLUDED.cash_inflow,
          refund_outflow = EXCLUDED.refund_outflow,
          transferred_to_treasury = EXCLUDED.transferred_to_treasury,
          retained_in_drawer = EXCLUDED.retained_in_drawer,
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
        body.cashInflow || 0,
        body.refundOutflow || 0,
        body.transferredToTreasury || 0,
        body.retainedInDrawer || 0,
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
