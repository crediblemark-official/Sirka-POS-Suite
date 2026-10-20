use rusqlite::Connection;
use serde_json::json;
use tauri_app_lib::local_db::*;
use tauri_app_lib::models::*;

fn setup_test_conn() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    init_schema(&conn).unwrap();
    conn
}

#[test]
fn test_clear_cache() {
    let conn = setup_test_conn();
    local_upsert_markup(&conn, "SEMBAKO", 15.0, None).unwrap();
    assert_eq!(local_get_markups(&conn).unwrap().len(), 1);
    local_clear_cache(&conn).unwrap();
    assert_eq!(local_get_markups(&conn).unwrap().len(), 0);
}

#[test]
fn test_product_and_markup_workflow() {
    let conn = setup_test_conn();
    local_upsert_markup(&conn, "SEMBAKO", 15.0, Some("Bahan pokok")).unwrap();
    let markups = local_get_markups(&conn).unwrap();
    assert_eq!(markups.len(), 1);
    assert_eq!(markups[0].category, "SEMBAKO");

    let p = ProductRecord {
        id: "p1".into(),
        code: "BRG-01".into(),
        name: "Beras 5kg".into(),
        category: "SEMBAKO".into(),
        unit: "SAK".into(),
        default_markup_percent: 15.0,
        last_buy_price: 60000.0,
        last_sell_price: 69000.0,
        stock: 20.0,
        barcode: Some("899123456789".into()),
        notes: None,
    };
    local_upsert_product(&conn, &p).unwrap();
    let products = local_get_products(&conn).unwrap();
    assert_eq!(products.len(), 1);
    assert_eq!(products[0].name, "Beras 5kg");
    assert_eq!(products[0].barcode.as_deref(), Some("899123456789"));
}

#[test]
fn test_transaction_stock_deduction_and_rollback() {
    let mut conn = setup_test_conn();
    local_upsert_markup(&conn, "SNACK", 10.0, None).unwrap();
    let p = ProductRecord {
        id: "snack1".into(),
        code: "SNK-01".into(),
        name: "Keripik".into(),
        category: "SNACK".into(),
        unit: "BKS".into(),
        default_markup_percent: 10.0,
        last_buy_price: 5000.0,
        last_sell_price: 6000.0,
        stock: 10.0,
        barcode: None,
        notes: None,
    };
    local_upsert_product(&conn, &p).unwrap();

    let b = BuyerRecord {
        id: "b1".into(),
        name: "Toko Berkah".into(),
        code: None,
        phone: None,
        address: None,
        customer_type: Some("B2B".into()),
        member_card_no: Some("MEM-001".into()),
        tier: None,
        points: Some(50.0),
        total_spend: Some(0.0),
        member_since: None,
    };
    local_upsert_buyer(&conn, &b).unwrap();

    let tx = TransactionRecord {
        id: "tx1".into(),
        invoice_no: "INV-001".into(),
        date: "2026-10-20".into(),
        buyer: "Toko Berkah".into(),
        items: json!([
            { "productId": "snack1", "qty": 3.0, "sellPrice": 6000.0, "buyPrice": 5000.0 }
        ]),
        total_buy: 15000.0,
        total_sell: 18000.0,
        total_profit: 3000.0,
        profit_percent: 20.0,
        payment_status: "LUNAS".into(),
        payment_method: "Cash".into(),
        customer_type: Some("B2B".into()),
        notes: None,
        discount_amount: Some(0.0),
        discount_code: None,
        points_used: Some(10.0),
        points_discount: Some(1000.0),
        points_earned: Some(2.0),
        final_total: Some(17000.0),
        is_pre_order: Some(false),
        pic_name: Some("Budi".into()),
        created_at: None,
    };

    // 1. Create transaction -> Stock berkurang dari 10 menjadi 7
    local_create_transaction(&mut conn, &tx, Some("b1")).unwrap();
    let prods = local_get_products(&conn).unwrap();
    assert_eq!(prods[0].stock, 7.0, "Stock should decrease by 3");

    // Buyer points: 50 - 10 + 2 = 42
    let buyers = local_get_buyers(&conn).unwrap();
    assert_eq!(buyers[0].points.unwrap(), 42.0);
    assert_eq!(buyers[0].total_spend.unwrap(), 17000.0);

    // 2. Delete transaction -> Stock harus kembali dari 7 menjadi 10
    local_delete_transaction(&mut conn, "tx1").unwrap();
    let prods_after = local_get_products(&conn).unwrap();
    assert_eq!(prods_after[0].stock, 10.0, "Stock should be rolled back to 10");

    // Buyer points restored: 42 + 10 - 2 = 50
    let buyers_after = local_get_buyers(&conn).unwrap();
    assert_eq!(buyers_after[0].points.unwrap(), 50.0);
    assert_eq!(buyers_after[0].total_spend.unwrap(), 0.0);
}

#[test]
fn test_outbox_queue_and_synced() {
    let conn = setup_test_conn();
    enqueue_outbox(&conn, "TEST_ACTION", &json!({ "foo": "bar" })).unwrap();

    let pending = get_pending_outbox(&conn, 10).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].action, "TEST_ACTION");

    mark_outbox_synced(&conn, pending[0].id).unwrap();
    let remaining = get_pending_outbox(&conn, 10).unwrap();
    assert_eq!(remaining.len(), 0);
}

#[test]
fn test_purchase_receipt_update_stock_rollback() {
    let mut conn = setup_test_conn();
    let p = ProductRecord {
        id: "rice1".into(),
        code: "BRS-01".into(),
        name: "Beras".into(),
        category: "SEMBAKO".into(),
        unit: "KG".into(),
        default_markup_percent: 10.0,
        last_buy_price: 10000.0,
        last_sell_price: 11000.0,
        stock: 5.0,
        barcode: None,
        notes: None,
    };
    local_upsert_product(&conn, &p).unwrap();

    // 1. Simpan nota kulakan pertama: masuk 10 kg -> stok jadi 15 kg
    let rcp1 = json!({
        "id": "rcp-001",
        "supplierInvoiceNo": "INV-SUP-1",
        "items": [
            { "productId": "rice1", "qtyReceived": 10.0, "buyPrice": 10000.0, "newSellPrice": 11000.0 }
        ]
    });
    local_save_purchase(&mut conn, &rcp1).unwrap();
    let prods1 = local_get_products(&conn).unwrap();
    assert_eq!(prods1[0].stock, 15.0);

    // 2. Edit nota kulakan: diubah jadi 12 kg -> stok harus jadi 17 kg (BUKAN 27 kg!)
    let rcp2 = json!({
        "id": "rcp-001",
        "supplierInvoiceNo": "INV-SUP-1",
        "items": [
            { "productId": "rice1", "qtyReceived": 12.0, "buyPrice": 10000.0, "newSellPrice": 11000.0 }
        ]
    });
    local_save_purchase(&mut conn, &rcp2).unwrap();
    let prods2 = local_get_products(&conn).unwrap();
    assert_eq!(prods2[0].stock, 17.0, "Stock must correctly reflect 5 + 12 = 17, not 15 + 12 = 27");

    // 3. Hapus nota kulakan -> stok harus kembali ke 5 kg semula
    local_delete_purchase(&mut conn, "rcp-001").unwrap();
    let prods3 = local_get_products(&conn).unwrap();
    assert_eq!(prods3[0].stock, 5.0, "Stock should return to initial 5");
}

#[test]
fn test_outbox_max_retry_failed_and_retry_all() {
    let conn = setup_test_conn();
    let id = enqueue_outbox(&conn, "BAD_ACTION", &json!({})).unwrap();

    // Gagal 4 kali -> masih PENDING
    for _ in 0..4 {
        mark_outbox_failed(&conn, id, "temporary error").unwrap();
    }
    let pending = get_pending_outbox(&conn, 10).unwrap();
    assert_eq!(pending.len(), 1);

    // Gagal ke-5 -> berubah jadi FAILED sehingga tidak memblok antrean
    mark_outbox_failed(&conn, id, "fatal error").unwrap();
    let pending_after = get_pending_outbox(&conn, 10).unwrap();
    assert_eq!(pending_after.len(), 0, "Item must not block pending outbox queue anymore");

    // Ketika retry dipanggil (misal tombol Sinkronkan Manual) -> kembali ke PENDING
    retry_failed_outbox(&conn).unwrap();
    let pending_retried = get_pending_outbox(&conn, 10).unwrap();
    assert_eq!(pending_retried.len(), 1, "Failed items must be retried when force sync is invoked");
}

#[test]
fn test_discount_usage_count_on_transaction() {
    let mut conn = setup_test_conn();
    let d = DiscountRecord {
        id: "d1".into(),
        code: "PROMO10".into(),
        name: "Diskon 10%".into(),
        r#type: "PERCENT".into(),
        value: 10.0,
        min_purchase: 0.0,
        max_discount: None,
        scope: "ALL".into(),
        target_category: None,
        target_customer_type: None,
        is_active: true,
        description: None,
        usage_count: Some(0),
        created_at: None,
    };
    local_upsert_discount(&conn, &d).unwrap();

    let tx = TransactionRecord {
        id: "tx-disc".into(),
        invoice_no: "INV-DISC-01".into(),
        date: "2026-10-20".into(),
        buyer: "Umum".into(),
        items: json!([]),
        total_buy: 1000.0,
        total_sell: 2000.0,
        total_profit: 1000.0,
        profit_percent: 50.0,
        payment_status: "LUNAS".into(),
        payment_method: "Cash".into(),
        customer_type: Some("B2C".into()),
        notes: None,
        discount_amount: Some(200.0),
        discount_code: Some("PROMO10".into()),
        points_used: None,
        points_discount: None,
        points_earned: None,
        final_total: Some(1800.0),
        is_pre_order: None,
        pic_name: None,
        created_at: None,
    };

    // Create tx -> usage_count bertambah 1
    local_create_transaction(&mut conn, &tx, None).unwrap();
    let disc = local_get_discounts(&conn).unwrap();
    assert_eq!(disc[0].usage_count.unwrap(), 1);

    // Delete tx -> usage_count berkurang balik ke 0
    local_delete_transaction(&mut conn, "tx-disc").unwrap();
    let disc_after = local_get_discounts(&conn).unwrap();
    assert_eq!(disc_after[0].usage_count.unwrap(), 0);
}

#[test]
fn test_purchase_receipt_items_normalization() {
    let mut conn = setup_test_conn();
    let rcp = json!({
        "id": "rcp-norm-1",
        "supplierInvoiceNo": "INV-VENDOR-99",
        "date": "2026-10-21",
        "supplier": "SEMBAKO",
        "totalBuy": 50000.0,
        "notes": "Pengiriman pagi",
        "items": [
            {
                "id": "item-1",
                "productId": "prod-1",
                "code": "GULA-01",
                "name": "Gula Pasir",
                "category": "SEMBAKO",
                "unit": "KG",
                "qtyReceived": 2.0,
                "buyPrice": 15000.0,
                "subtotalBuy": 30000.0,
                "markupPercent": 10.0,
                "newSellPrice": 16500.0
            },
            {
                "id": "item-2",
                "productId": "prod-2",
                "code": "MINYAK-01",
                "name": "Minyak Goreng",
                "category": "SEMBAKO",
                "unit": "LITER",
                "qtyReceived": 1.0,
                "buyPrice": 20000.0,
                "subtotalBuy": 20000.0,
                "markupPercent": 15.0,
                "newSellPrice": 23000.0
            }
        ]
    });

    local_save_purchase(&mut conn, &rcp).unwrap();

    // Verifikasi kolom header purchase_receipts tersimpan
    let (inv_no, supplier, total_buy): (String, String, f64) = conn
        .query_row(
            "SELECT supplier_invoice_no, supplier, total_buy FROM purchase_receipts WHERE id = 'rcp-norm-1'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    assert_eq!(inv_no, "INV-VENDOR-99");
    assert_eq!(supplier, "SEMBAKO");
    assert_eq!(total_buy, 50000.0);

    // Verifikasi tabel relasional purchase_receipt_items
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM purchase_receipt_items WHERE receipt_id = 'rcp-norm-1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 2);

    let (name, qty, subtotal): (String, f64, f64) = conn
        .query_row(
            "SELECT name, qty_received, subtotal_buy FROM purchase_receipt_items WHERE id = 'item-1'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    assert_eq!(name, "Gula Pasir");
    assert_eq!(qty, 2.0);
    assert_eq!(subtotal, 30000.0);

    // Hapus nota -> pastikan purchase_receipt_items juga terhapus
    local_delete_purchase(&mut conn, "rcp-norm-1").unwrap();
    let count_after: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM purchase_receipt_items WHERE receipt_id = 'rcp-norm-1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count_after, 0);
}

#[test]
fn test_get_purchases_reads_from_normalized_items_not_jsonb() {
    let mut conn = setup_test_conn();
    let rcp = json!({
        "id": "rcp-read-1",
        "supplierInvoiceNo": "INV-READ-1",
        "date": "2026-10-21",
        "supplier": "SEMBAKO",
        "totalBuy": 30000.0,
        "items": [
            {
                "id": "item-r1",
                "productId": "prod-r1",
                "code": "TERIG-01",
                "name": "Tepung Terigu",
                "category": "SEMBAKO",
                "unit": "KG",
                "qtyReceived": 2.0,
                "buyPrice": 15000.0,
                "subtotalBuy": 30000.0,
                "markupPercent": 10.0,
                "newSellPrice": 16500.0
            }
        ]
    });
    local_save_purchase(&mut conn, &rcp).unwrap();

    // Simulasikan kolom JSONB legacy sudah dikosongkan / tidak sinkron.
    //-nota yang dibaca harus tetap utuh karena sumbernya tabel purchase_receipt_items.
    conn.execute(
        "UPDATE purchase_receipts SET receipt = '{\"items\":[]}' WHERE id = 'rcp-read-1'",
        [],
    )
    .unwrap();

    let list = local_get_purchases(&conn).unwrap();
    assert_eq!(list.len(), 1);
    let items = list[0].get("items").and_then(|v| v.as_array()).unwrap();
    assert_eq!(items.len(), 1, "Item harus dibaca dari tabel ternormalisasi");
    assert_eq!(items[0].get("name").unwrap(), "Tepung Terigu");
    assert_eq!(items[0].get("productId").unwrap(), "prod-r1");
    assert_eq!(items[0].get("qtyReceived").unwrap(), 2.0);
    assert_eq!(items[0].get("buyPrice").unwrap(), 15000.0);
    assert_eq!(items[0].get("newSellPrice").unwrap(), 16500.0);
}

#[test]
fn test_legacy_jsonb_receipt_is_backfilled_to_items_table() {
    let conn = setup_test_conn();

    // Simulasikan nota lama: hanya ada di kolom JSONB, tabel items masih kosong.
    let legacy = json!({
        "id": "rcp-legacy-1",
        "supplierInvoiceNo": "INV-LEGACY",
        "date": "2026-10-01",
        "supplier": "SEMBAKO",
        "totalBuy": 15000.0,
        "items": [
            {
                "id": "legacy-item-1",
                "productId": "prod-legacy",
                "code": "GARAM-01",
                "name": "Garam",
                "category": "SEMBAKO",
                "unit": "PCS",
                "qtyReceived": 1.0,
                "buyPrice": 15000.0,
                "subtotalBuy": 15000.0,
                "markupPercent": 0.0,
                "newSellPrice": 15000.0
            }
        ]
    });
    conn.execute(
        "INSERT INTO purchase_receipts (id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        rusqlite::params![
            "rcp-legacy-1",
            "INV-LEGACY",
            "2026-10-01",
            "SEMBAKO",
            15000.0,
            "nota lama",
            legacy.to_string()
        ],
    )
    .unwrap();

    // Backfill dijalankan setiap init_schema (startup aplikasi).
    init_schema(&conn).unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM purchase_receipt_items WHERE receipt_id = 'rcp-legacy-1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1, "Nota legacy harus dinormalisasi ke tabel items");

    let (name, qty): (String, f64) = conn
        .query_row(
            "SELECT name, qty_received FROM purchase_receipt_items WHERE id = 'legacy-item-1'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(name, "Garam");
    assert_eq!(qty, 1.0);

    // Pembacaan nota juga harus konsisten (tidak rely solely pada JSONB)
    let list = local_get_purchases(&conn).unwrap();
    let found = list
        .iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some("rcp-legacy-1"))
        .expect("Nota legacy harus terbaca");
    let items = found.get("items").and_then(|v| v.as_array()).unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].get("name").unwrap(), "Garam");
}

