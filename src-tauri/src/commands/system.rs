use std::fs;

/// Menyimpan file export secara native ke filesystem (mendukung binary seperti .xlsx)
#[tauri::command]
pub fn save_export_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    let target_path = if std::path::Path::new(&filename).is_absolute() {
        std::path::PathBuf::from(&filename)
    } else {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_default();
        let downloads = std::path::Path::new(&home).join("Downloads");
        if downloads.exists() {
            downloads.join(&filename)
        } else {
            std::path::PathBuf::from(&filename)
        }
    };

    fs::write(&target_path, data)
        .map_err(|e| format!("Gagal menulis file: {}", e))?;
    Ok(format!("File berhasil disimpan di: {}", target_path.display()))
}

/// BUG-014 FIX: Menghasilkan format cetak nota thermal (teks polos lebar 32 kolom,
/// siap dikirim ke printer thermal 58mm / ditempel ke driver cetak label) dari
/// data transaksi lengkap di Rust. Menerima objek transaction JSON dari frontend.
#[tauri::command]
pub fn generate_receipt_text(
    tx: serde_json::Value,
    store_name: Option<String>,
) -> Result<String, String> {
    if !tx.is_object() {
        return Err("Data transaksi tidak valid".into());
    }

    let width = 32usize;
    let dashes = "-".repeat(width);
    let equals = "=".repeat(width);

    let get_str = |key: &str| -> String {
        tx.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };
    let get_num = |key: &str| -> f64 {
        tx.get(key)
            .and_then(|v| v.as_f64())
            .or_else(|| tx.get(key).and_then(|v| v.as_str()).and_then(|s| s.parse().ok()))
            .unwrap_or(0.0)
    };
    let get_bool = |key: &str| -> bool { tx.get(key).and_then(|v| v.as_bool()).unwrap_or(false) };

    let store = store_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "KASIR CITRA".to_string())
        .to_uppercase();

    let customer_type = get_str("customerType");
    let is_b2c = customer_type == "B2C";
    let is_pre_order = get_bool("isPreOrder");
    let payment_status = get_str("paymentStatus");
    let payment_method = get_str("paymentMethod");

    // Helper alignment
    fn row(left: &str, right: &str, width: usize) -> String {
        let right = right.to_string();
        let l_len = left.chars().count();
        let r_len = right.chars().count();
        if l_len + r_len + 1 >= width {
            format!("{}\n{:>width$}", left, right, width = width)
        } else {
            let spaces = " ".repeat(width - l_len - r_len);
            format!("{}{}{}", left, spaces, right)
        }
    }

    let mut out = String::new();
    // Header (diposisikan di tengah 32 kolom)
    let title = if is_b2c {
        "STRUK NOTA PENJUALAN"
    } else {
        "FAKTUR PENJUALAN B2B"
    };
    for text in [&store, title] {
        let len = text.chars().count();
        let pad = if len < width { (width - len) / 2 } else { 0 };
        out.push_str(&format!("{}{}\n", " ".repeat(pad), text));
    }
    out.push_str(&equals);
    out.push('\n');
    out.push_str(&row("No", get_str("invoiceNo").as_str(), width));
    out.push('\n');
    out.push_str(&row("Tgl", get_str("date").as_str(), width));
    out.push('\n');
    let buyer_label = if is_b2c { "Pelanggan" } else { "Pembeli " };
    out.push_str(&row(buyer_label, get_str("buyer").as_str(), width));
    out.push('\n');
    out.push_str(&row("Status", &format!("{} ({})", payment_status, payment_method), width));
    out.push('\n');
    if !get_str("picName").is_empty() {
        out.push_str(&row("PIC", get_str("picName").as_str(), width));
        out.push('\n');
    }
    out.push_str(&dashes);
    out.push('\n');

    // Items
    let mut item_count = 0usize;
    if let Some(items) = tx.get("items").and_then(|v| v.as_array()) {
        for (idx, it) in items.iter().enumerate() {
            item_count += 1;
            let name = it.get("name").and_then(|v| v.as_str()).unwrap_or("?");
            let qty = it.get("qty").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let unit = it.get("unit").and_then(|v| v.as_str()).unwrap_or("");
            let price = it.get("sellPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let subtotal = it
                .get("subtotalSell")
                .and_then(|v| v.as_f64())
                .unwrap_or(qty * price);
            let qty_txt = if qty.fract() == 0.0 {
                format!("{}", qty as i64)
            } else {
                format!("{:.1}", qty)
            };
            out.push_str(&format!("{}. {}\n", idx + 1, name));
            out.push_str(&row(
                &format!("  {} {} x {}", qty_txt, unit, fmt_rp(price)),
                &fmt_rp(subtotal),
                width,
            ));
            out.push('\n');
        }
    }
    out.push_str(&dashes);
    out.push('\n');

    // Total & diskon
    let total_sell = get_num("totalSell");
    let discount = get_num("discountAmount");
    let points_discount = get_num("pointsDiscount");
    let final_total = {
        let f = get_num("finalTotal");
        if f > 0.0 { f } else { total_sell - discount - points_discount }
    };

    out.push_str(&row(&format!("{} item", item_count), &format!("Rp {}", fmt_rp(total_sell)), width));
    out.push('\n');
    if discount > 0.0 {
        let code = get_str("discountCode");
        out.push_str(&row("Diskon", &format!("-Rp {} ({})", fmt_rp(discount), code), width));
        out.push('\n');
    }
    if points_discount > 0.0 {
        out.push_str(&row("Tukar Poin", &format!("-Rp {}", fmt_rp(points_discount)), width));
        out.push('\n');
    }
    out.push_str(&dashes);
    out.push('\n');
    out.push_str(&row("TOTAL", &format!("Rp {}", fmt_rp(final_total)), width));
    out.push('\n');

    let points_earned = get_num("pointsEarned");
    if points_earned > 0.0 {
        out.push_str(&row("Poin Didapat", &format!("+{}", points_earned as i64), width));
        out.push('\n');
    }

    // Blok tanda terima (fokus Gap-3 untuk faktur B2B; ringkas untuk B2C)
    if !is_b2c {
        out.push_str(&dashes);
        out.push('\n');
        out.push_str("TANDA TERIMA PENGIRIMAN\n");
        out.push_str(&"\n\n".repeat(1));
        out.push_str("(_________________) (_________________)\n");
        out.push_str("  Penerima (PIC)     Pengirim\n");
    }

    out.push_str(&dashes);
    out.push('\n');
    if is_pre_order {
        out.push_str("Ket: Sesuai nota pesanan\n");
    } else if payment_status == "TEMPO" {
        out.push_str("Ket: BON / TEMPO (Piutang)\n");
    } else {
        out.push_str("Terima kasih. LUNAS penuh.\n");
    }

    Ok(out)
}

/// Format Rupiah dengan pemisah ribuan titik (untuk struk thermal)
fn fmt_rp(v: f64) -> String {
    let n = v.round() as i64;
    let sign = if n < 0 { "-" } else { "" };
    let digits = n.unsigned_abs().to_string();
    let mut out = String::new();
    let chars: Vec<char> = digits.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        if i > 0 && (chars.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(*c);
    }
    format!("{}{}", sign, out)
}

/// Meminimalkan jendela aplikasi
#[tauri::command]
pub fn window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Toggle maximize / restore ukuran jendela
#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

/// Menutup aplikasi
#[tauri::command]
pub fn window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

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
        let out = generate_receipt_text(sample_b2b_tx(), Some("AGST SEP".into())).unwrap();
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
        let out = generate_receipt_text(tx, None).unwrap();
        assert!(out.contains("STRUK NOTA PENJUALAN"));
        assert!(!out.contains("TANDA TERIMA PENGIRIMAN"));
    }

    #[test]
    fn receipt_rejects_invalid_payload() {
        let err = generate_receipt_text(serde_json::json!(42), None);
        assert!(err.is_err());
    }
}
