import { Client } from 'pg';
import { INITIAL_CATEGORY_MARKUPS, INITIAL_PRODUCTS } from '../src/data/initialProducts';
import { INITIAL_PREORDERS } from '../src/data/initialPreOrders';

async function seed() {
  const client = new Client({
    connectionString: 'postgres://kasir_citra_user:kasir_citra_password@localhost:5434/kasir_citra_db',
  });

  await client.connect();
  console.log('Connected to PostgreSQL at localhost:5434');

  try {
    // 1. Seed Category Markups
    for (const cm of INITIAL_CATEGORY_MARKUPS) {
      await client.query(
        `INSERT INTO category_markups (category, default_markup_percent, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (category) DO UPDATE
         SET default_markup_percent = EXCLUDED.default_markup_percent,
             description = EXCLUDED.description`,
        [cm.category, cm.defaultMarkupPercent, cm.description]
      );
    }
    console.log(`✓ Seeded ${INITIAL_CATEGORY_MARKUPS.length} category markups`);

    // 2. Seed Products
    for (const prod of INITIAL_PRODUCTS) {
      await client.query(
        `INSERT INTO products (id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE
         SET code = EXCLUDED.code,
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             unit = EXCLUDED.unit,
             default_markup_percent = EXCLUDED.default_markup_percent,
             last_buy_price = EXCLUDED.last_buy_price,
             last_sell_price = EXCLUDED.last_sell_price,
             stock = EXCLUDED.stock,
             notes = EXCLUDED.notes`,
        [
          prod.id,
          prod.code,
          prod.name,
          prod.category,
          prod.unit,
          prod.defaultMarkupPercent,
          prod.lastBuyPrice,
          prod.lastSellPrice,
          prod.stock,
          prod.notes || null,
        ]
      );
    }
    console.log(`✓ Seeded ${INITIAL_PRODUCTS.length} products across 9 supplier categories`);

    // 3. Seed PreOrders
    for (const po of INITIAL_PREORDERS) {
      await client.query(
        `INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET buyer = EXCLUDED.buyer, items = EXCLUDED.items`,
        [po.id, po.date, po.dayName, po.buyer, JSON.stringify(po.items), false]
      );
    }
    console.log(`✓ Seeded ${INITIAL_PREORDERS.length} weekly pre-order schedules`);

    // 4. Seed Initial Buyers
    const INITIAL_BUYERS = [
      { id: 'buyer-1', name: 'Pembeli Banjarsari', code: 'BUYER-BJS', customerType: 'B2B' },
      { id: 'buyer-2', name: 'Pembeli Pahlawan', code: 'BUYER-PHL', customerType: 'B2B' },
      { id: 'buyer-3', name: 'Pembeli Mangunharjo', code: 'BUYER-MGH', customerType: 'B2B' },
      { id: 'buyer-b2c-umum', name: 'Pelanggan Umum (Eceran)', code: 'ECERAN', customerType: 'B2C', address: 'Walk-in Customer / Eceran Toko' }
    ];
    for (const b of INITIAL_BUYERS) {
      await client.query(
        `INSERT INTO buyers (id, name, code, customer_type, address)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, customer_type = EXCLUDED.customer_type`,
        [b.id, b.name, b.code, b.customerType, b.address || null]
      );
    }
    console.log(`✓ Seeded ${INITIAL_BUYERS.length} initial buyers`);

    console.log('\n🌟 Database seeding completed successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
