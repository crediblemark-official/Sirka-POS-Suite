import { Hono } from 'hono';
import { Bindings } from '../types';
import { withPg } from '../db';

export const reportsRoute = new Hono<{ Bindings: Bindings }>();

// 1. Laporan Laba Rugi & Arus Kas (Income Statement & Cash Flow)
reportsRoute.get('/financial-report', async (c) => {
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
reportsRoute.get('/inventory-valuation', async (c) => {
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
