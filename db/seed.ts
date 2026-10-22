import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function seed() {
  // BUG FIX: `JSON.parse(fs.readFileSync(...))` berada DI LUAR try -> file
  // `public/demo-data.json` yang hilang menghasilkan stack ENOENT yang tidak
  // terbaca. Sekarang pesan error yang jelas.
  const demoDataPath = path.join(__dirname, '../public/demo-data.json');
  let demoData: any;
  try {
    demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf-8'));
  } catch (err: any) {
    console.error(
      `Gagal membaca data demo di ${demoDataPath}: ${err?.message || err}\n` +
      `Pastikan file public/demo-data.json tersedia, lalu jalankan ulang "bun run db:seed".`
    );
    process.exitCode = 1;
    return;
  }

  const INITIAL_CATEGORY_MARKUPS = demoData.categoryMarkups || [];
  const INITIAL_PRODUCTS = demoData.products || [];
  const INITIAL_PREORDERS = demoData.preOrders || [];

  // BUG FIX: kredensial database tidak lagi ditulis literal di source code.
  // Ambil dari environment variable DATABASE_URL (lihat .env.example).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'DATABASE_URL belum diset.\n' +
      'Contoh: DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/kasir_citra_db\n' +
      'Atau set env var di shell sebelum menjalankan seed.'
    );
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString });

  // BUG FIX: `client.connect()` berada di luar try -> bila PostgreSQL mati,
  // `finally { client.end() }` tidak pernah dijalankan dan error-nya menjadi
  // unhandled rejection.
  try {
    await client.connect();
    console.log('Terhubung ke PostgreSQL');
  } catch (err: any) {
    console.error(`Gagal terhubung ke PostgreSQL: ${err?.message || err}`);
    process.exitCode = 1;
    return;
  }

  try {
    // 1. Seed Category Markups
    // BUG FIX: kolom `color` tidak pernah diisi -> semua kategori seed selalu
    // jatuh ke warna hash. Sekarang warna ikut di-seed.
    for (const cm of INITIAL_CATEGORY_MARKUPS) {
      await client.query(
        `INSERT INTO category_markups (category, default_markup_percent, description, color)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category) DO UPDATE
         SET default_markup_percent = EXCLUDED.default_markup_percent,
             description = EXCLUDED.description,
             color = COALESCE(EXCLUDED.color, category_markups.color)`,
        [cm.category, cm.defaultMarkupPercent, cm.description, cm.color || null]
      );
    }
    console.log(`✓ Seeded ${INITIAL_CATEGORY_MARKUPS.length} category markups`);

    // 2. Seed Products
    for (const prod of INITIAL_PRODUCTS) {
      await client.query(
        `INSERT INTO products (id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, notes, barcode, units)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE
         SET code = EXCLUDED.code,
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             unit = EXCLUDED.unit,
             default_markup_percent = EXCLUDED.default_markup_percent,
             last_buy_price = EXCLUDED.last_buy_price,
             last_sell_price = EXCLUDED.last_sell_price,
             stock = EXCLUDED.stock,
             notes = EXCLUDED.notes,
             barcode = COALESCE(EXCLUDED.barcode, products.barcode),
             units = COALESCE(EXCLUDED.units, products.units)`,
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
          prod.barcode || null,
          prod.units ? JSON.stringify(prod.units) : null,
        ]
      );
    }
    console.log(`✓ Seeded ${INITIAL_PRODUCTS.length} products`);

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
  } catch (err: any) {
    console.error('Seeding error:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

// BUG FIX: `seed()` tanpa .catch() -> unhandled rejection & exit code tidak
// menyatakan kegagalan.
seed().catch((err) => {
  console.error('Seed gagal:', err?.message || err);
  process.exitCode = 1;
});
