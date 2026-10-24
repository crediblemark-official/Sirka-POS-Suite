import { Hono } from 'hono';
import { Client } from 'pg';
import { Bindings } from '../types';
import { withPg } from '../db';

export const shiftsRoute = new Hono<{ Bindings: Bindings }>();

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
      shiftsSchemaReady = null;
      throw err;
    });
  }
  return shiftsSchemaReady;
}

// 10. Pergantian Shift Kasir & Rekonsiliasi Kas (Cashier Shifts)
shiftsRoute.get('/shifts', async (c) => {
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

shiftsRoute.post('/shifts', async (c) => {
  const dbUrl = c.env.DATABASE_URL;
  try {
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
