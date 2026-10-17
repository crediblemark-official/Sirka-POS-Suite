/// <reference types="bun-types" />
import { Client } from 'pg';

const PG_URL = process.env.DATABASE_URL || 'postgres://kasir_citra_user:kasir_citra_password@localhost:5434/kasir_citra_db';

const client = new Client({ connectionString: PG_URL });

async function initDb() {
  try {
    await client.connect();
    console.log(`[Database] Connected to PostgreSQL on ${PG_URL}`);
  } catch (err) {
    console.error('[Database] Failed to connect to PostgreSQL:', err);
  }
}

initDb();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const server = Bun.serve({
  port: 3001,
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // 1. Health check
      if (url.pathname === '/api/health') {
        const res = await client.query('SELECT NOW() as time, version()');
        return new Response(JSON.stringify({ status: 'ok', serverTime: res.rows[0].time }), { headers });
      }

      // 2. Products
      if (url.pathname === '/api/products') {
        if (req.method === 'GET') {
          const res = await client.query('SELECT * FROM products ORDER BY category, name');
          return new Response(JSON.stringify(res.rows.map(r => ({
            id: r.id,
            code: r.code,
            name: r.name,
            category: r.category,
            unit: r.unit,
            defaultMarkupPercent: Number(r.default_markup_percent),
            lastBuyPrice: Number(r.last_buy_price),
            lastSellPrice: Number(r.last_sell_price),
            stock: Number(r.stock),
            notes: r.notes
          }))), { headers });
        }

        if (req.method === 'POST') {
          const body = await req.json();
          const id = body.id || `prod-${Date.now()}`;
          await client.query(
            `INSERT INTO products (id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
               last_buy_price = EXCLUDED.last_buy_price,
               last_sell_price = EXCLUDED.last_sell_price,
               stock = EXCLUDED.stock,
               updated_at = NOW()`,
            [
              id,
              body.code,
              body.name,
              body.category,
              body.unit,
              body.defaultMarkupPercent || 20,
              body.lastBuyPrice || 0,
              body.lastSellPrice || 0,
              body.stock || 0,
              body.notes || null
            ]
          );
          return new Response(JSON.stringify({ success: true, id }), { headers });
        }
      }

      // 3. Markups
      if (url.pathname === '/api/markups') {
        if (req.method === 'GET') {
          const res = await client.query('SELECT * FROM category_markups ORDER BY category');
          return new Response(JSON.stringify(res.rows.map(r => ({
            category: r.category,
            defaultMarkupPercent: Number(r.default_markup_percent),
            description: r.description
          }))), { headers });
        }

        if (req.method === 'PUT') {
          const body = await req.json();
          await client.query(
            `UPDATE category_markups SET default_markup_percent = $1 WHERE category = $2`,
            [body.defaultMarkupPercent, body.category]
          );
          return new Response(JSON.stringify({ success: true }), { headers });
        }
      }

      // 4. Pre-Orders
      if (url.pathname === '/api/preorders') {
        if (req.method === 'GET') {
          const res = await client.query('SELECT * FROM pre_orders ORDER BY date, buyer');
          return new Response(JSON.stringify(res.rows.map(r => ({
            id: r.id,
            date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
            dayName: r.day_name,
            buyer: r.buyer,
            items: r.items,
            isLoadedToPos: r.is_loaded_to_pos
          }))), { headers });
        }
      }

      // 5. Transactions (Ledger)
      if (url.pathname === '/api/transactions') {
        if (req.method === 'GET') {
          const res = await client.query('SELECT * FROM transactions ORDER BY created_at DESC');
          return new Response(JSON.stringify(res.rows.map(r => ({
            id: r.id,
            invoiceNo: r.invoice_no,
            date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
            buyer: r.buyer,
            items: r.items,
            totalBuy: Number(r.total_buy),
            totalSell: Number(r.total_sell),
            totalProfit: Number(r.total_profit),
            profitPercent: Number(r.profit_percent),
            paymentStatus: r.payment_status,
            paymentMethod: r.payment_method,
            notes: r.notes,
            createdAt: r.created_at
          }))), { headers });
        }

        if (req.method === 'POST') {
          const t = await req.json();
          await client.query(
            `INSERT INTO transactions (id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit, profit_percent, payment_status, payment_method, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO UPDATE SET
               buyer = EXCLUDED.buyer,
               payment_status = EXCLUDED.payment_status,
               payment_method = EXCLUDED.payment_method`,
            [
              t.id,
              t.invoiceNo,
              t.date,
              t.buyer,
              JSON.stringify(t.items),
              t.totalBuy,
              t.totalSell,
              t.totalProfit,
              t.profitPercent,
              t.paymentStatus,
              t.paymentMethod,
              t.notes || null,
              t.createdAt || new Date().toISOString()
            ]
          );

          // Update last buy & sell prices for items
          for (const item of t.items) {
            if (item.buyPrice > 0) {
              await client.query(
                `UPDATE products SET last_buy_price = $1, last_sell_price = $2, updated_at = NOW() WHERE id = $3`,
                [item.buyPrice, item.sellPrice, item.productId]
              );
            }
          }

          return new Response(JSON.stringify({ success: true, invoiceNo: t.invoiceNo }), { headers });
        }
      }

      // 6. Buyers (Dynamic & Loyalty Membership)
      if (url.pathname === '/api/buyers') {
        if (req.method === 'GET') {
          const res = await client.query('SELECT id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend, member_since FROM buyers ORDER BY created_at ASC');
          return new Response(JSON.stringify(res.rows.map(r => ({
            id: r.id,
            name: r.name,
            code: r.code,
            phone: r.phone,
            address: r.address,
            customerType: r.customer_type,
            memberCardNo: r.member_card_no,
            tier: r.tier || 'REGULAR',
            points: Number(r.points || 0),
            totalSpend: Number(r.total_spend || 0),
            memberSince: r.member_since
          }))), { headers });
        }

        if (req.method === 'POST') {
          const b = await req.json();
          await client.query(
            `INSERT INTO buyers (id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               phone = EXCLUDED.phone,
               address = EXCLUDED.address,
               customer_type = EXCLUDED.customer_type,
               member_card_no = COALESCE(EXCLUDED.member_card_no, buyers.member_card_no),
               tier = COALESCE(EXCLUDED.tier, buyers.tier),
               points = COALESCE(EXCLUDED.points, buyers.points),
               total_spend = COALESCE(EXCLUDED.total_spend, buyers.total_spend)`,
            [
              b.id,
              b.name,
              b.code || null,
              b.phone || null,
              b.address || null,
              b.customerType || 'B2B',
              b.memberCardNo || null,
              b.tier || 'REGULAR',
              b.points || 0,
              b.totalSpend || 0
            ]
          );
          return new Response(JSON.stringify({ success: true, id: b.id }), { headers });
        }
      }

      // 7. Discounts & Promo Vouchers
      if (url.pathname === '/api/discounts') {
        if (req.method === 'GET') {
          const res = await client.query('SELECT * FROM discounts ORDER BY created_at DESC');
          return new Response(JSON.stringify(res.rows.map(r => ({
            id: r.id,
            code: r.code,
            name: r.name,
            type: r.type,
            value: Number(r.value),
            minPurchase: Number(r.min_purchase || 0),
            maxDiscount: r.max_discount ? Number(r.max_discount) : null,
            scope: r.scope,
            targetCategory: r.target_category,
            targetCustomerType: r.target_customer_type,
            isActive: r.is_active,
            description: r.description,
            usageCount: Number(r.usage_count || 0),
            createdAt: r.created_at
          }))), { headers });
        }

        if (req.method === 'POST') {
          const d = await req.json();
          await client.query(
            `INSERT INTO discounts (id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description)
             VALUES ($1, UPPER($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               code = UPPER(EXCLUDED.code),
               name = EXCLUDED.name,
               type = EXCLUDED.type,
               value = EXCLUDED.value,
               min_purchase = EXCLUDED.min_purchase,
               max_discount = EXCLUDED.max_discount,
               scope = EXCLUDED.scope,
               target_category = EXCLUDED.target_category,
               target_customer_type = EXCLUDED.target_customer_type,
               is_active = EXCLUDED.is_active,
               description = EXCLUDED.description`,
            [
              d.id,
              d.code,
              d.name,
              d.type || 'PERCENT',
              d.value || 0,
              d.minPurchase || 0,
              d.maxDiscount || null,
              d.scope || 'ALL',
              d.targetCategory || null,
              d.targetCustomerType || null,
              d.isActive ?? true,
              d.description || null
            ]
          );
          return new Response(JSON.stringify({ success: true, id: d.id }), { headers });
        }
      }

      if (url.pathname.startsWith('/api/discounts/') && req.method === 'DELETE') {
        const id = url.pathname.split('/')[3];
        await client.query('DELETE FROM discounts WHERE id = $1', [id]);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (url.pathname.startsWith('/api/discounts/') && url.pathname.endsWith('/toggle') && req.method === 'PATCH') {
        const parts = url.pathname.split('/');
        const id = parts[3];
        const body = await req.json();
        await client.query('UPDATE discounts SET is_active = $1 WHERE id = $2', [body.isActive, id]);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // 8. Toggle payment status
      if (url.pathname.startsWith('/api/transactions/') && url.pathname.endsWith('/status') && req.method === 'PATCH') {
        const parts = url.pathname.split('/');
        const txId = parts[3];
        const body = await req.json();
        await client.query(
          `UPDATE transactions SET payment_status = $1 WHERE id = $2`,
          [body.paymentStatus, txId]
        );
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers });
    } catch (err: any) {
      console.error('[API Error]', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }
});

console.log(`[Kasir Citra API] Running at http://localhost:${server.port}`);
