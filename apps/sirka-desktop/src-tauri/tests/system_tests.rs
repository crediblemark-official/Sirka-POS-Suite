use tauri_app_lib::commands::system::{
    generate_delivery_order_text, generate_kitchen_ticket_text, generate_receipt_text,
};

fn sample_b2b_tx() -> serde_json::Value {
    serde_json::json!({
        "invoiceNo": "INV-20261019-0001",
        "date": "2026-10-19",
        "buyer": "Dapur Banjarsari",
        "customerType": "B2B",
        "paymentStatus": "TEMPO",
        "paymentMethod": "Nota Tempo",
        "picName": "Bu Siti",
        "items": [
            { "name": "BERAS RAJA LELE 5KG", "qty": 10.0, "unit": "ZAK", "sellPrice": 120000.0, "subtotalSell": 1200000.0 }
        ],
        "totalSell": 1200000.0,
        "discountAmount": 0.0,
        "pointsDiscount": 0.0,
        "finalTotal": 1200000.0,
        "isPreOrder": false
    })
}

#[test]
fn receipt_renders_items_total_pic_and_tanda_terima() {
    let out = generate_receipt_text(sample_b2b_tx(), Some("AGST SEP".into()), None).unwrap();
    assert!(out.contains("AGST SEP"));
    assert!(out.contains("FAKTUR PENJUALAN B2B"));
    assert!(out.contains("INV-20261019-0001"));
    assert!(out.contains("BERAS RAJA LELE 5KG"));
    assert!(out.contains("10 ZAK x 120.000"));
    assert!(out.contains("1.200.000"));
    assert!(out.contains("Bu Siti"));
    assert!(out.contains("TANDA TERIMA PENGIRIMAN"));
    assert!(out.contains("TEMPO"));
}

#[test]
fn receipt_b2c_is_achievable_without_tanda_terima() {
    let mut tx = sample_b2b_tx();
    tx["customerType"] = serde_json::json!("B2C");
    let out = generate_receipt_text(tx, None, None).unwrap();
    assert!(out.contains("STRUK NOTA PENJUALAN"));
    assert!(!out.contains("TANDA TERIMA PENGIRIMAN"));
}

#[test]
fn receipt_supports_80mm_width() {
    let out = generate_receipt_text(sample_b2b_tx(), Some("CITRA POS".into()), Some("80mm".into())).unwrap();
    assert!(out.contains("=".repeat(42).as_str()));
}

#[test]
fn receipt_rejects_invalid_payload() {
    let err = generate_receipt_text(serde_json::json!(42), None, None);
    assert!(err.is_err());
}

#[test]
fn kitchen_ticket_renders_items_modifiers_and_table_without_prices() {
    let fnb_tx = serde_json::json!({
        "invoiceNo": "INV-FNB-001",
        "date": "2026-10-28",
        "buyer": "Meja 4 (Dine-in)",
        "orderType": "DINE_IN",
        "tableNo": "Meja 4",
        "staffName": "Rian (Waitstaff)",
        "items": [
            {
                "name": "Nasi Goreng Spesial",
                "qty": 2.0,
                "unit": "PORSI",
                "sellPrice": 25000.0,
                "selectedModifiers": ["Pedas Sedang", "Telur Ceplok Setengah Matang"],
                "notes": "Jangan pakai timun"
            },
            {
                "name": "Es Jeruk Manis",
                "qty": 2.0,
                "unit": "GELAS",
                "sellPrice": 8000.0,
                "selectedModifiers": ["Sedikit Es"]
            }
        ]
    });

    let out = generate_kitchen_ticket_text(fnb_tx, Some("Kafe Santai".into()), None).unwrap();
    assert!(out.contains("TIKET DAPUR / BAR"));
    assert!(out.contains("Meja 4"));
    assert!(out.contains("Nasi Goreng Spesial (x2 PORSI)"));
    assert!(out.contains(">> Pedas Sedang, Telur Ceplok Setengah Matang"));
    assert!(out.contains("Catatan: Jangan pakai timun"));
    // Kitchen ticket must NOT leak sensitive pricing
    assert!(!out.contains("25.000"));
    assert!(!out.contains("Rp "));
}

#[test]
fn delivery_order_renders_surat_jalan_signatures_and_no_prices() {
    let b2b_tx = serde_json::json!({
        "invoiceNo": "SJ-20261028-09",
        "date": "2026-10-28",
        "buyer": "PT Mega Distribusi",
        "picName": "Pak Joko",
        "items": [
            { "name": "Beras Premium", "qty": 50.0, "unit": "SAK", "sellPrice": 125000.0 }
        ]
    });

    let out = generate_delivery_order_text(b2b_tx, Some("Gudang Sirka".into()), None).unwrap();
    assert!(out.contains("SURAT JALAN PENGIRIMAN"));
    assert!(out.contains("PT Mega Distribusi"));
    assert!(out.contains("Pak Joko"));
    assert!(out.contains("50 SAK"));
    assert!(out.contains("Pengirim / Supir:"));
    assert!(out.contains("Penerima Toko:"));
    // Delivery order must NOT show financial amount
    assert!(!out.contains("125.000"));
    assert!(!out.contains("TOTAL PEMBAYARAN"));
}


