use crate::db::get_pg_client;
use crate::local_db::{
    count_pending_outbox, get_conn, get_pending_outbox, local_clear_cache, local_get_products,
    local_save_preorder_direct, local_save_purchase_direct, local_save_transaction_direct,
    local_update_setting_direct, local_upsert_buyer, local_upsert_discount_direct,
    local_upsert_markup, local_upsert_product, mark_outbox_synced,
    park_outbox_item,
};
use crate::models::{
    BuyerRecord, DiscountRecord, PreOrderRecord, ProductRecord, ProductUnitConversionRecord,
    TransactionRecord,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

static IS_ONLINE: AtomicBool = AtomicBool::new(false);
static LAST_SYNC_TIME: Mutex<Option<String>> = Mutex::new(None);
static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
static SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncStatusInfo {
    pub is_online: bool,
    pub pending_count: i64,
    pub last_sync_time: Option<String>,
    pub last_error: Option<String>,
}

pub fn get_status() -> SyncStatusInfo {
    let pending_count = {
        let conn = get_conn().lock().unwrap();
        count_pending_outbox(&conn).unwrap_or(0)
    };
    let is_online = IS_ONLINE.load(Ordering::Relaxed);
    let mut last_err = LAST_ERROR.lock().unwrap().clone();

    // Jika antrean outbox sudah 0 dan online, hapus error outbox sementara masa lalu
    if pending_count == 0 && is_online {
        if let Some(err) = &last_err {
            if !err.starts_with("Offline:") {
                last_err = None;
                *LAST_ERROR.lock().unwrap() = None;
            }
        }
    }

    SyncStatusInfo {
        is_online,
        pending_count,
        last_sync_time: LAST_SYNC_TIME.lock().unwrap().clone(),
        last_error: last_err,
    }
}

pub async fn run_sync_cycle() -> Result<(), String> {
    // Hindari race condition & sambungan Postgres bertumpuk:
    // Jika sync sedang berjalan, outbox baru akan diproses oleh loop worker yang aktif
    let _guard = match SYNC_LOCK.try_lock() {
        Ok(g) => g,
        Err(_) => return Ok(()),
    };

    match tokio::time::timeout(Duration::from_secs(12), run_sync_cycle_internal()).await {
        Ok(res) => res,
        Err(_) => {
            eprintln!("[Sync] Siklus sinkronisasi timeout setelah 12s");
            Err("Sinkronisasi timeout".into())
        }
    }
}

pub async fn run_sync_cycle_force() -> Result<(), String> {
    let _guard = SYNC_LOCK.lock().await;
    {
        let conn = get_conn().lock().unwrap();
        let _ = crate::local_db::retry_failed_outbox(&conn);
    }
    run_sync_cycle_internal().await
}

async fn run_sync_cycle_internal() -> Result<(), String> {
    // 1. Cek koneksi ke PostgreSQL Cloud
    let mut pg = match get_pg_client().await {
        Ok(client) => {
            IS_ONLINE.store(true, Ordering::Relaxed);
            client
        }
        Err(e) => {
            IS_ONLINE.store(false, Ordering::Relaxed);
            *LAST_ERROR.lock().unwrap() = Some(format!("Offline: {}", e));
            return Err(e);
        }
    };

    // 2. Inisialisasi awal: jika SQLite lokal masih kosong produknya, tarik dari PG
    pull_if_empty(&mut pg).await.ok();

    // 3. Push seluruh pending outbox lokal ke PostgreSQL Cloud
    push_outbox(&mut pg).await?;

    // Update waktu sync berhasil dan bersihkan status error
    let now_str = chrono::Utc::now().to_rfc3339();
    *LAST_SYNC_TIME.lock().unwrap() = Some(now_str);
    *LAST_ERROR.lock().unwrap() = None;

    Ok(())
}

/// Jeda minimum antar pull master data (menjaga agar sinkronisasi 5 detik
/// tidak menarik ratusan baris pada setiap siklus).
const MASTER_PULL_INTERVAL: std::time::Duration = std::time::Duration::from_secs(5 * 60);
/// Jeda minimum antar pull riwayat (transaksi & nota).
const HISTORY_PULL_INTERVAL: std::time::Duration = std::time::Duration::from_secs(30 * 60);

static LAST_MASTER_PULL: Mutex<Option<std::time::Instant>> = Mutex::new(None);
static LAST_HISTORY_PULL: Mutex<Option<std::time::Instant>> = Mutex::new(None);
static LAST_EMPTY_PULL_ATTEMPT: Mutex<Option<std::time::Instant>> = Mutex::new(None);

fn should_pull(slot: &Mutex<Option<std::time::Instant>>, interval: std::time::Duration) -> bool {
    let mut guard = match slot.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    let now = std::time::Instant::now();
    let due = match *guard {
        None => true,
        Some(last) => now.duration_since(last) >= interval,
    };
    if due {
        *guard = Some(now);
    }
    due
}

/**
 * Tarik master data (kategori, produk, pembeli, kupon, pre-order) dari cloud.
 *
 * BUG FIX: sebelumnya pull HANYA berjalan bila tabel `products` lokal kosong.
 * Perangkat yang sudah punya 1 produk (mis. import demo, atau sync pertama
 * yang produknya sukses tapi pembeli gagal) TIDAK PERNAH menarik pembeli,
 * kupon, dan riwayat dari cloud. Sekarang master data selalu ditarik — dengan
 * jeda minimum 5 menit agar tidak membebani koneksi pada siklus sync 5 detik.
 *
 * Riwayat (transaksi & nota) ditarik dengan jeda 30 menit.
 */
async fn pull_if_empty(pg: &mut tokio_postgres::Client) -> Result<(), String> {
    let (has_products, has_transactions) = {
        let conn = get_conn().lock().unwrap();
        let prods = local_get_products(&conn).unwrap_or_default();
        let tx_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
            .unwrap_or(0);
        (!prods.is_empty(), tx_count > 0)
    };

    if !has_products {
        if should_pull(&LAST_EMPTY_PULL_ATTEMPT, std::time::Duration::from_secs(60)) {
            let _ = pull_master_data_from_cloud(pg).await;
            let _ = pull_history_from_cloud(pg).await;
        }
        return Ok(());
    }

    // Master data — ditarik berkala (default 5 menit) supaya perubahan
    // master di perangkat lain sampai ke sini.
    if should_pull(&LAST_MASTER_PULL, MASTER_PULL_INTERVAL) {
        let _ = pull_master_data_from_cloud(pg).await;
    }

    // Riwayat — lebih jarang (default 30 menit) & hanya bila lokal belum punya.
    if !has_transactions || should_pull(&LAST_HISTORY_PULL, HISTORY_PULL_INTERVAL) {
        let _ = pull_history_from_cloud(pg).await;
    }

    Ok(())
}


/// Tarik master data dari cloud (idempotent).
async fn pull_master_data_from_cloud(pg: &mut tokio_postgres::Client) -> Result<(), String> {
    let tx = match pg.transaction().await {
        Ok(t) => t,
        Err(e) => return Err(format!("Gagal membuka transaksi PG untuk master data: {}", e)),
    };

    // 1. Pull Markups
    if let Ok(rows) = tx
        .query(
            "SELECT category, default_markup_percent::float8, description, color FROM category_markups",
            &[],
        )
        .await
    {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            let cat: String = r.get(0);
            let pct: f64 = r.get(1);
            let desc: Option<String> = r.get(2);
            let color: Option<String> = r.get(3);
            let _ = local_upsert_markup(&conn, &cat, pct, desc.as_deref(), color.as_deref());
        }
    }

    // 2. Pull Products
    if let Ok(rows) = tx
        .query(
            "SELECT id, code, name, category, unit, default_markup_percent::float8,
                    last_buy_price::float8, last_sell_price::float8, stock::float8, barcode, notes,
                    supplier, units::text, is_perishable
             FROM products",
            &[],
        )
        .await
    {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            // BUG FIX: kolom `units` bertipe JSONB. Membacanya sebagai
            // `Option<String>` membuat `Row::get` PANIC ("was not accepted")
            // karena String hanya menerima VARCHAR/TEXT. Panik ini mematikan
            // seluruh background sync (panic = abort di build release).
            // Solusi: cast ke ::text di SQL lalu parse sebagai JSON.
            let units_json: Option<String> = r.get(12);
            let units: Option<Vec<ProductUnitConversionRecord>> = units_json
                .as_deref()
                .filter(|raw| !raw.trim().is_empty() && *raw != "[]" && *raw != "null")
                .and_then(|raw| serde_json::from_str(raw).ok());
            let p = ProductRecord {
                id: r.get(0),
                code: r.get(1),
                name: r.get(2),
                category: r.get(3),
                unit: r.get(4),
                default_markup_percent: r.get(5),
                last_buy_price: r.get(6),
                last_sell_price: r.get(7),
                stock: r.get(8),
                barcode: r.get(9),
                notes: r.get(10),
                supplier: r.get(11),
                units,
                is_perishable: Some(r.get::<_, Option<bool>>(13).unwrap_or(false)),
            };
            let _ = local_upsert_product(&conn, &p);
        }
    }

    // 3. Pull Buyers
    if let Ok(rows) = tx
        .query(
            "SELECT id, name, code, phone, address, customer_type, member_card_no, tier,
                    points::float8, total_spend::float8, member_since::text, notes
             FROM buyers",
            &[],
        )
        .await
    {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            let b = BuyerRecord {
                id: r.get(0),
                name: r.get(1),
                code: r.get(2),
                phone: r.get(3),
                address: r.get(4),
                customer_type: r.get(5),
                member_card_no: r.get(6),
                tier: r.get(7),
                points: r.get(8),
                total_spend: r.get(9),
                member_since: r.get(10),
                notes: r.get(11),
            };
            let _ = local_upsert_buyer(&conn, &b);
        }
    }

    // 4. Pull Settings
    if let Ok(rows) = tx.query("SELECT key, value FROM store_settings", &[]).await {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            let k: String = r.get(0);
            let v: String = r.get(1);
            let _ = local_update_setting_direct(&conn, &k, &v);
        }
    }

    // 5. Pull Discounts
    if let Ok(rows) = tx
        .query(
            "SELECT id, code, name, type, value::float8, min_purchase::float8, max_discount::float8,
                    scope, target_category, target_customer_type, is_active, description, usage_count, created_at::text
             FROM discounts",
            &[],
        )
        .await
    {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            let d = DiscountRecord {
                id: r.get(0),
                code: r.get(1),
                name: r.get(2),
                r#type: r.get(3),
                value: r.get(4),
                min_purchase: r.get(5),
                max_discount: r.get(6),
                scope: r.get(7),
                target_category: r.get(8),
                target_customer_type: r.get(9),
                is_active: r.get(10),
                description: r.get(11),
                usage_count: r.get(12),
                created_at: r.get(13),
            };
            let _ = local_upsert_discount_direct(&conn, &d);
        }
    }

    let _ = tx.commit().await;
    Ok(())
}

/// Tarik riwayat (transaksi & nota kulakan) dari cloud.
async fn pull_history_from_cloud(pg: &mut tokio_postgres::Client) -> Result<(), String> {
    let tx = match pg.transaction().await {
        Ok(t) => t,
        Err(e) => return Err(format!("Gagal membuka transaksi PG untuk riwayat: {}", e)),
    };

    // 6. Pull Pre-orders
    if let Ok(rows) = tx
        .query(
            "SELECT id, date::text, day_name, buyer, items, is_loaded_to_pos
             FROM pre_orders",
            &[],
        )
        .await
    {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            let po = PreOrderRecord {
                id: r.get(0),
                date: r.get(1),
                day_name: r.get(2),
                buyer: r.get(3),
                items: r.get(4),
                is_loaded_to_pos: r.get(5),
            };
            let _ = local_save_preorder_direct(&conn, &po);
        }
    }

    // 7. Pull Recent Transactions (limit 500)
    if let Ok(rows) = tx
        .query(
            "SELECT id, invoice_no, date::text, buyer, items, total_buy::float8, total_sell::float8,
                    total_profit::float8, profit_percent::float8, payment_status, payment_method,
                    customer_type, notes, discount_amount::float8, discount_code, points_used::float8,
                    points_discount::float8, points_earned::float8, final_total::float8,
                    is_pre_order, pic_name, created_at::text,
                    is_split_payment, cash_amount::float8, non_cash_amount::float8,
                    non_cash_method, change_amount::float8, infaq_amount::float8,
                    shift_id, refund_status, refund_total::float8
             FROM transactions ORDER BY created_at DESC LIMIT 500",
            &[],
        )
        .await
    {
        let conn = get_conn().lock().unwrap();
        for r in rows {
            let tx_record = TransactionRecord {
                id: r.get(0),
                invoice_no: r.get(1),
                date: r.get(2),
                buyer: r.get(3),
                items: r.get(4),
                total_buy: r.get(5),
                total_sell: r.get(6),
                total_profit: r.get(7),
                profit_percent: r.get(8),
                payment_status: r.get(9),
                payment_method: r.get(10),
                customer_type: r.get(11),
                notes: r.get(12),
                discount_amount: r.get(13),
                discount_code: r.get(14),
                points_used: r.get(15),
                points_discount: r.get(16),
                points_earned: r.get(17),
                final_total: r.get(18),
                is_pre_order: r.get(19),
                pic_name: r.get(20),
                created_at: r.get(21),
                // BUG FIX: field split payment / kembalian / infaq / shift /
                // refund ikut ditarik agar data cloud & lokal konsisten.
                is_split_payment: r.get(22),
                cash_amount: r.get(23),
                non_cash_amount: r.get(24),
                non_cash_method: r.get(25),
                change_amount: r.get(26),
                infaq_amount: r.get(27),
                shift_id: r.get(28),
                refund_status: r.get(29),
                refund_total: r.get(30),
            };
            let _ = local_save_transaction_direct(&conn, &tx_record);
        }
    }

    // 8. Pull Recent Purchases (limit 500)
    // Item nota diambil sekaligus dalam 1 query ternormalisasi `purchase_receipt_items`,
    // mencegah N+1 network roundtrips ke PostgreSQL.
    let mut pulled_purchases: Vec<Value> = Vec::new();
    if let Ok(rows) = tx
        .query(
            "SELECT id, supplier_invoice_no, date, supplier, total_buy, notes, created_at::text
             FROM purchase_receipts ORDER BY created_at DESC LIMIT 500",
            &[],
        )
        .await
    {
        let mut receipt_ids: Vec<String> = Vec::new();
        for r in &rows {
            receipt_ids.push(r.get(0));
        }

        let mut items_by_receipt: std::collections::HashMap<String, Vec<Value>> = std::collections::HashMap::new();
        if !receipt_ids.is_empty() {
            if let Ok(item_rows) = tx
                .query(
                    "SELECT receipt_id, id, product_id, code, name, category, unit,
                            qty_received::float8, buy_price::float8, subtotal_buy::float8,
                            markup_percent::float8, new_sell_price::float8,
                            base_qty::float8, conversion_factor::float8
                     FROM purchase_receipt_items WHERE receipt_id = ANY($1)
                     ORDER BY created_at ASC, id ASC",
                    &[&receipt_ids],
                )
                .await
            {
                for ir in &item_rows {
                    let r_id: String = ir.get(0);
                    items_by_receipt.entry(r_id).or_default().push(serde_json::json!({
                        "id": ir.get::<_, Option<String>>(1).unwrap_or_default(),
                        "productId": ir.get::<_, Option<String>>(2).unwrap_or_default(),
                        "code": ir.get::<_, Option<String>>(3).unwrap_or_default(),
                        "name": ir.get::<_, Option<String>>(4).unwrap_or_default(),
                        "category": ir.get::<_, Option<String>>(5).unwrap_or_default(),
                        "unit": ir.get::<_, Option<String>>(6).unwrap_or_default(),
                        "qtyReceived": ir.get::<_, Option<f64>>(7).unwrap_or(0.0),
                        "buyPrice": ir.get::<_, Option<f64>>(8).unwrap_or(0.0),
                        "subtotalBuy": ir.get::<_, Option<f64>>(9).unwrap_or(0.0),
                        "markupPercent": ir.get::<_, Option<f64>>(10).unwrap_or(0.0),
                        "newSellPrice": ir.get::<_, Option<f64>>(11).unwrap_or(0.0),
                        "baseQty": ir.get::<_, Option<f64>>(12).unwrap_or(0.0),
                        "conversionFactor": ir.get::<_, Option<f64>>(13).unwrap_or(1.0),
                    }));
                }
            }
        }

        for r in rows {
            let id: String = r.get(0);
            let supplier_inv: Option<String> = r.get(1);
            let r_date: Option<String> = r.get(2);
            let supplier: Option<String> = r.get(3);
            let total_buy: Option<f64> = r.get(4);
            let notes: Option<String> = r.get(5);
            let created_at: Option<String> = r.get(6);

            let mut items = items_by_receipt.remove(&id).unwrap_or_default();

            // Fallback: nota lama yang itemnya belum dinormalisasi -> ambil dari JSONB
            if items.is_empty() {
                if let Ok(Some(row)) = tx
                    .query_opt("SELECT receipt FROM purchase_receipts WHERE id = $1", &[&id])
                    .await
                {
                    let receipt: Value = row.get(0);
                    items = receipt
                        .get("items")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                }
            }

            let mut obj = serde_json::Map::new();
            obj.insert("id".into(), serde_json::json!(id));
            obj.insert(
                "supplierInvoiceNo".into(),
                serde_json::json!(supplier_inv.unwrap_or_default()),
            );
            obj.insert("date".into(), serde_json::json!(r_date.unwrap_or_default()));
            obj.insert(
                "supplier".into(),
                serde_json::json!(supplier.unwrap_or_default()),
            );
            obj.insert("items".into(), serde_json::json!(items));
            obj.insert(
                "totalBuy".into(),
                serde_json::json!(total_buy.unwrap_or(0.0)),
            );
            if let Some(n) = notes {
                if !n.is_empty() {
                    obj.insert("notes".into(), serde_json::json!(n));
                }
            }
            obj.insert(
                "createdAt".into(),
                serde_json::json!(created_at.unwrap_or_default()),
            );
            pulled_purchases.push(Value::Object(obj));
        }
    }

    let _ = tx.commit().await;

    if !pulled_purchases.is_empty() {
        let conn = get_conn().lock().unwrap();
        for val in &pulled_purchases {
            let _ = local_save_purchase_direct(&conn, val);
        }
    }

    Ok(())
}


pub async fn pull_all_from_cloud(pg: &mut tokio_postgres::Client) -> Result<(), String> {
    pull_master_data_from_cloud(pg).await?;
    pull_history_from_cloud(pg).await?;
    Ok(())
}

pub async fn reset_cache_and_resync() -> Result<SyncStatusInfo, String> {
    // 1. Verifikasi koneksi PostgreSQL Cloud terlebih dahulu agar aman
    let mut pg = match get_pg_client().await {
        Ok(client) => client,
        Err(e) => {
            return Err(format!(
                "Gagal terhubung ke PostgreSQL Cloud: {}. Pembersihan dibatalkan demi keamanan data lokal.",
                e
            ));
        }
    };

    // BUG FIX (kehilangan data): `local_clear_cache` menghapus SELURUH isi
    // tabel `sync_outbox`. Kalau ada penjualan/ancangan yang belum sempat
    // terkirim ke cloud (mode offline), menekan "Bersihkan Cache & Resync"
    // akan MENGHAPUS transaksi tersebut dari perangkat DAN tidak pernah
    // mengirimnya ke cloud -> data penjualan hilang permanen.
    //
    // Solusi: dorong antrean outbox ke cloud DULU. Hanya jika antrean kosong
    // (semua sudah tersinkron) cache lokal yang dibersihkan.
    {
        let pending = {
            let conn = get_conn().lock().unwrap();
            count_pending_outbox(&conn).unwrap_or(0)
        };
        if pending > 0 {
            // Coba kirimkan dulu (best effort)
            let _ = push_outbox(&mut pg).await;
            let still_pending = {
                let conn = get_conn().lock().unwrap();
                count_pending_outbox(&conn).unwrap_or(0)
            };
            if still_pending > 0 {
                return Err(format!(
                    "Terdapat {} perubahan lokal yang belum tersinkron ke cloud. \
                     Cache lokal TIDAK dibersihkan demi mencegah kehilangan data penjualan. \
                     Periksa koneksi internet lalu coba lagi.",
                    still_pending
                ));
            }
        }
    }

    // 2. Kosongkan seluruh data lokal di SQLite
    {
        let conn = get_conn().lock().unwrap();
        local_clear_cache(&conn)
            .map_err(|e| format!("Gagal membersihkan cache lokal: {}", e))?;
    }

    // 3. Tarik data bersih terbaru dari Cloud
    pull_all_from_cloud(&mut pg).await?;

    // 4. Update status
    IS_ONLINE.store(true, Ordering::SeqCst);
    let now_str = chrono::Utc::now().to_rfc3339();
    *LAST_SYNC_TIME.lock().unwrap() = Some(now_str);
    *LAST_ERROR.lock().unwrap() = None;

    Ok(get_status())
}

pub async fn wipe_all_data(wipe_cloud: bool) -> Result<SyncStatusInfo, String> {
    // 1. Kunci SYNC_LOCK agar proses sinkronisasi dan reset tidak saling bertabrakan
    let _guard = SYNC_LOCK.lock().await;

    if wipe_cloud {
        let wipe_fut = async {
            let pg = get_pg_client().await.map_err(|e| format!("Koneksi PostgreSQL gagal: {}", e))?;
            // Coba TRUNCATE CASCADE terlebih dahulu
            match pg.batch_execute(
                "TRUNCATE TABLE transactions, pre_orders, purchase_receipt_items, purchase_receipts,
                    discounts, buyers, products, category_markups, store_settings, cashier_shifts, suppliers CASCADE;",
            ).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    eprintln!("[Wipe Cloud] TRUNCATE gagal ({}), mencoba fallback DELETE...", e);
                    let pg_del = get_pg_client().await.map_err(|e| format!("Koneksi fallback gagal: {}", e))?;
                    pg_del.batch_execute(
                        "BEGIN;
                         DELETE FROM purchase_receipt_items;
                         DELETE FROM purchase_receipts;
                         DELETE FROM transactions;
                         DELETE FROM pre_orders;
                         DELETE FROM discounts;
                         DELETE FROM buyers;
                         DELETE FROM products;
                         DELETE FROM category_markups;
                         DELETE FROM store_settings;
                         DELETE FROM cashier_shifts;
                         DELETE FROM suppliers;
                         COMMIT;",
                    ).await.map_err(|e| format!("DELETE fallback gagal: {}", e))
                }
            }
        };

        // Batasi maksimal 8 detik untuk proses pengosongan cloud
        match tokio::time::timeout(Duration::from_secs(8), wipe_fut).await {
            Ok(Ok(_)) => println!("[Wipe Cloud] Data cloud berhasil dikosongkan."),
            Ok(Err(e)) => return Err(format!("Gagal mengosongkan data cloud: {}", e)),
            Err(_) => return Err("Gagal mengosongkan data cloud: Waktu habis / timeout (8s)".into()),
        }
    }

    {
        let conn = get_conn().lock().unwrap();
        local_clear_cache(&conn)
            .map_err(|e| format!("Gagal mengosongkan SQLite lokal: {}", e))?;
    }

    // Set interval pull ke waktu sekarang agar background sync tidak langsung
    // mencoba menarik data dari database yang baru saja dikosongkan
    let now = std::time::Instant::now();
    *LAST_MASTER_PULL.lock().unwrap() = Some(now);
    *LAST_HISTORY_PULL.lock().unwrap() = Some(now);
    *LAST_EMPTY_PULL_ATTEMPT.lock().unwrap() = Some(now);

    IS_ONLINE.store(true, Ordering::SeqCst);
    let now_str = chrono::Utc::now().to_rfc3339();
    *LAST_SYNC_TIME.lock().unwrap() = Some(now_str);
    *LAST_ERROR.lock().unwrap() = None;

    Ok(get_status())
}


async fn push_outbox(pg: &mut tokio_postgres::Client) -> Result<(), String> {
    // BUG FIX: head-of-line blocking. Sebelumnya satu item yang gagal
    // (mis. nama pembeli > 100 karakter di PG) langsung `return Err` sehingga
    // SEMUA item di belakangnya tidak pernah terkirim — dan karena
    // `get_pending_outbox` mengurutkan `ORDER BY id ASC`, item rusak itu
    // selalu jadi kepala antrean pada setiap siklus berikutnya.
    //
    // Sekarang: item yang gagal dipark (status FAILED) dan siklus LANJUT ke
    // item berikutnya. Error dikumpulkan dan dikembalikan di akhir supaya UI
    // tetap menampilkan Ringkasan tetapi antrean tidak macet.
    let mut first_error: Option<String> = None;
    let mut total_pushed = 0usize;
    // Pengaman: batasi jumlah iterasi agar tidak loop tak berujung bila
    // `mark_outbox_synced` gagal (baris tetap PENDING dan dibaca lagi).
    for _ in 0..200 {
        let items = {
            let conn = get_conn().lock().unwrap();
            get_pending_outbox(&conn, 25).unwrap_or_default()
        };

        if items.is_empty() {
            break;
        }

        let mut progressed = false;
        for item in items {
            match execute_push(pg, &item.action, &item.payload).await {
                Ok(_) => {
                    let conn = get_conn().lock().unwrap();
                    if mark_outbox_synced(&conn, item.id).is_ok() {
                        progressed = true;
                        total_pushed += 1;
                    }
                }
                Err(err) => {
                    let err_str = err.to_string();
                    // Idempotency: jika sudah ada di PG, anggap berhasil
                    if err_str.contains("sudah ada")
                        || err_str.contains("already exists")
                        || err_str.contains("unique constraint")
                    {
                        let conn = get_conn().lock().unwrap();
                        let _ = mark_outbox_synced(&conn, item.id);
                        progressed = true;
                        total_pushed += 1;
                    } else {
                        // Park item ini (status FAILED, TIDAK PENDING) dan
                        // LANJUT ke item berikutnya — jangan hentikan seluruh
                        // antrean. Item yang diparkir masih bisa dicoba ulang
                        // lewat tombol "Sinkronkan Manual".
                        let conn = get_conn().lock().unwrap();
                        let _ = park_outbox_item(&conn, item.id, &err_str);
                        if first_error.is_none() {
                            first_error = Some(err_str.clone());
                            *LAST_ERROR.lock().unwrap() = Some(err_str);
                        }
                        progressed = true;
                    }
                }
            }
        }

        // Tidak ada progres -> seluruh item yang tersisa pasti GAGAL terus
        // (mis. constraint error permanen). Hentikan agar tidak membanjiri
        // server dengan percobaan yang sama berulang-ulang.
        if !progressed {
            break;
        }
    }

    if total_pushed > 0 {
        println!("[Sync Push] {} item terkirim ke cloud", total_pushed);
    }
    match first_error {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

async fn execute_push(
    pg: &mut tokio_postgres::Client,
    action: &str,
    payload: &Value,
) -> Result<(), String> {
    match action {
        "CREATE_TRANSACTION" => {
            let tx_val = payload.get("tx").ok_or("Payload tx hilang")?;
            let tx: TransactionRecord =
                serde_json::from_value(tx_val.clone()).map_err(|e| e.to_string())?;
            let member_id = payload
                .get("memberId")
                .and_then(Value::as_str)
                .map(|s| s.to_string());

            crate::commands::transactions::pg_create_transaction(tx, member_id).await?;
        }
        "UPDATE_TRANSACTION_STATUS" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            let status = payload
                .get("paymentStatus")
                .and_then(Value::as_str)
                .ok_or("status hilang")?;
            crate::commands::transactions::pg_update_transaction_status(
                id.to_string(),
                status.to_string(),
            )
            .await?;
        }
        "DELETE_TRANSACTION" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            crate::commands::transactions::pg_delete_transaction(id.to_string()).await?;
        }
        "UPSERT_PRODUCT" => {
            let prod_val = payload.get("product").unwrap_or(payload);
            let prod: ProductRecord =
                serde_json::from_value(prod_val.clone()).map_err(|e| e.to_string())?;
            crate::commands::products::pg_upsert_product(prod).await?;
        }
        "DELETE_PRODUCT" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            crate::commands::products::pg_delete_product(id.to_string()).await?;
        }
        "UPDATE_STOCK_AND_PRICE" => {
            let pid = payload
                .get("productId")
                .and_then(Value::as_str)
                .ok_or("productId hilang")?;
            let stock = payload
                .get("addedStock")
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let buy = payload.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = payload
                .get("sellPrice")
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            crate::commands::products::pg_update_stock_and_price(pid.to_string(), stock, buy, sell)
                .await?;
        }
        "UPDATE_MARKUP" => {
            let cat = payload
                .get("category")
                .and_then(Value::as_str)
                .ok_or("category hilang")?;
            let pct = payload
                .get("markupPercent")
                .and_then(Value::as_f64)
                .unwrap_or(20.0);
            let desc = payload
                .get("description")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            let color = payload
                .get("color")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            crate::commands::markups::pg_update_markup_full(
                cat.to_string(),
                pct,
                desc,
                color,
            )
            .await?;
        }
        "CREATE_MARKUP" => {
            let cat = payload
                .get("category")
                .and_then(Value::as_str)
                .ok_or("category hilang")?;
            let pct = payload
                .get("markupPercent")
                .and_then(Value::as_f64)
                .unwrap_or(20.0);
            let desc = payload
                .get("description")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            let color = payload
                .get("color")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            crate::commands::markups::pg_create_markup(cat.to_string(), pct, desc, color).await?;
        }
        "DELETE_MARKUP" => {
            let cat = payload
                .get("category")
                .and_then(Value::as_str)
                .ok_or("category hilang")?;
            crate::commands::markups::pg_delete_markup(cat.to_string()).await?;
        }
        "UPSERT_BUYER" => {
            let b_val = payload.get("buyer").unwrap_or(payload);
            let buyer: BuyerRecord =
                serde_json::from_value(b_val.clone()).map_err(|e| e.to_string())?;
            crate::commands::buyers::pg_upsert_buyer(buyer).await?;
        }
        "DELETE_BUYER" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            crate::commands::buyers::pg_delete_buyer(id.to_string()).await?;
        }
        "SAVE_PREORDER" => {
            let r_val = payload.get("record").unwrap_or(payload);
            let record: crate::models::PreOrderRecord =
                serde_json::from_value(r_val.clone()).map_err(|e| e.to_string())?;
            crate::commands::preorders::pg_save_preorder(record).await?;
        }
        "DELETE_PREORDER" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            crate::commands::preorders::pg_delete_preorder(id.to_string()).await?;
        }
        "SAVE_PURCHASE" => {
            let receipt = payload.get("receipt").unwrap_or(payload);
            crate::commands::purchases::pg_save_purchase(receipt.clone()).await?;
        }
        "DELETE_PURCHASE" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            crate::commands::purchases::pg_delete_purchase(id.to_string()).await?;
        }
        "UPSERT_DISCOUNT" => {
            let d_val = payload.get("discount").unwrap_or(payload);
            let d: crate::models::DiscountRecord =
                serde_json::from_value(d_val.clone()).map_err(|e| e.to_string())?;
            crate::commands::discounts::pg_upsert_discount(d).await?;
        }
        "DELETE_DISCOUNT" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            crate::commands::discounts::pg_delete_discount(id.to_string()).await?;
        }
        "TOGGLE_DISCOUNT" => {
            let id = payload
                .get("id")
                .and_then(Value::as_str)
                .ok_or("id hilang")?;
            let active = payload
                .get("isActive")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            crate::commands::discounts::pg_toggle_discount(id.to_string(), active).await?;
        }
        "UPDATE_SETTING" => {
            let key = payload
                .get("key")
                .and_then(Value::as_str)
                .ok_or("key hilang")?;
            let val = payload
                .get("value")
                .and_then(Value::as_str)
                .ok_or("value hilang")?;
            pg.execute(
                "INSERT INTO store_settings (key, value, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
                &[&key, &val],
            )
            .await
            .map_err(|e| format!("Gagal menyimpan pengaturan ke PostgreSQL {}: {}", key, e))?;
        }
        "SAVE_SHIFT" => {
            let s_val = payload.get("shift").unwrap_or(payload);
            let id = s_val.get("id").and_then(Value::as_str).ok_or("id shift hilang")?;
            let cashier_name = s_val.get("cashierName").or_else(|| s_val.get("cashier_name")).and_then(Value::as_str).unwrap_or("Kasir");
            let start_time = s_val.get("startTime").or_else(|| s_val.get("start_time")).and_then(Value::as_str).unwrap_or("");
            let end_time = s_val.get("endTime").or_else(|| s_val.get("end_time")).and_then(Value::as_str);
            let starting_cash = s_val.get("startingCash").or_else(|| s_val.get("starting_cash")).and_then(Value::as_f64).unwrap_or(0.0);
            let cash_sales = s_val.get("cashSales").or_else(|| s_val.get("cash_sales")).and_then(Value::as_f64).unwrap_or(0.0);
            let non_cash_sales = s_val.get("nonCashSales").or_else(|| s_val.get("non_cash_sales")).and_then(Value::as_f64).unwrap_or(0.0);
            let cash_outflow = s_val.get("cashOutflow").or_else(|| s_val.get("cash_outflow")).and_then(Value::as_f64).unwrap_or(0.0);
            let cash_inflow = s_val.get("cashInflow").or_else(|| s_val.get("cash_inflow")).and_then(Value::as_f64).unwrap_or(0.0);
            let refund_outflow = s_val.get("refundOutflow").or_else(|| s_val.get("refund_outflow")).and_then(Value::as_f64).unwrap_or(0.0);
            let transferred_to_treasury = s_val.get("transferredToTreasury").or_else(|| s_val.get("transferred_to_treasury")).and_then(Value::as_f64).unwrap_or(0.0);
            let retained_in_drawer = s_val.get("retainedInDrawer").or_else(|| s_val.get("retained_in_drawer")).and_then(Value::as_f64).unwrap_or(0.0);
            let expected_cash = s_val.get("expectedCash").or_else(|| s_val.get("expected_cash")).and_then(Value::as_f64).unwrap_or(0.0);
            let actual_cash = s_val.get("actualCash").or_else(|| s_val.get("actual_cash")).and_then(Value::as_f64);
            let discrepancy = s_val.get("discrepancy").and_then(Value::as_f64);
            let notes = s_val.get("notes").and_then(Value::as_str).unwrap_or("");
            let status = s_val.get("status").and_then(Value::as_str).unwrap_or("OPEN");

            let start_dt = chrono::DateTime::parse_from_rfc3339(start_time)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());
            let end_dt = end_time.and_then(|et| {
                chrono::DateTime::parse_from_rfc3339(et)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .ok()
            });

            pg.execute(
                "INSERT INTO cashier_shifts (
                    id, cashier_name, start_time, end_time, starting_cash, cash_sales,
                    non_cash_sales, cash_outflow, cash_inflow, refund_outflow,
                    transferred_to_treasury, retained_in_drawer, expected_cash, actual_cash, discrepancy,
                    notes, status, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    cashier_name = EXCLUDED.cashier_name,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    starting_cash = EXCLUDED.starting_cash,
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
                    updated_at = NOW()",
                &[
                    &id, &cashier_name, &start_dt, &end_dt, &starting_cash, &cash_sales,
                    &non_cash_sales, &cash_outflow, &cash_inflow, &refund_outflow,
                    &transferred_to_treasury, &retained_in_drawer, &expected_cash, &actual_cash, &discrepancy,
                    &notes, &status,
                ],
            )
            .await
            .map_err(|e| format!("Gagal menyimpan cashier_shift ke PostgreSQL {}: {}", id, e))?;
        }
        _ => {
            // BUG FIX: action yang tidak dikenal sebelumnya mengembalikan Ok(()) sehingga
            // outbox menandainya "synced" dan HAPUS PERMANEN tanpa retry/error
            // (cuma `println!` yang tidak terlihat di build release).
            // Sekarang dikembalikan sebagai error supaya item di-park dan
            // dilaporkan ke user.
            return Err(format!(
                "Aksi sinkronisasi tidak dikenal: '{}'. Data tidak dikirim ke cloud \
                 (periksa nama aksi di store yang memanggil enqueue).",
                action
            ));
        }
    }
    Ok(())
}

pub fn start_background_sync() {
    tauri::async_runtime::spawn(async move {
        // Delay 2 detik saat startup aplikasi
        tokio::time::sleep(Duration::from_secs(2)).await;
        loop {
            let _ = run_sync_cycle().await;
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
}
