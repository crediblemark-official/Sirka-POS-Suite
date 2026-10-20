use tauri_app_lib::commands::system::generate_receipt_text;

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
