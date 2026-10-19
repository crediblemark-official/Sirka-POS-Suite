use std::fs;

/// Menyimpan file export secara native ke filesystem
#[tauri::command]
pub fn save_export_file(filename: String, content: String) -> Result<String, String> {
    let path = std::path::Path::new(&filename);
    fs::write(path, content.as_bytes())
        .map_err(|e| format!("Gagal menulis file: {}", e))?;
    Ok(format!("File berhasil disimpan di: {}", filename))
}

/// Menghasilkan format cetak nota thermal secara native dari Rust
#[tauri::command]
pub fn generate_receipt_text(
    invoice_no: String,
    buyer: String,
    total_sell: f64,
    item_count: usize,
) -> String {
    format!(
        "================================\n  KASIR CITRA - NOTA TRANSAKSI\n================================\nNo Nota : {}\nPembeli : {}\nTotal   : Rp {:.0}\nJumlah  : {} item\n================================\nDicetak via Native Tauri Rust Engine\n",
        invoice_no, buyer, total_sell, item_count
    )
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
