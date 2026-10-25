use std::fs;
use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// Menyimpan file export secara native ke filesystem dengan dialog file picker (Explorer / Finder / Zenity)
#[tauri::command]
pub fn save_export_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    // BUG FIX (keamanan): nama file dari frontend tidak lagi dipakai mentah-mentah.
    // Nilai berisi path separator (mis. "../../.bashrc") bisa membuat file ditulis
    // di luar folder yang dipilih. Sekarang hanya NAMA FILE yang dipakai
    // (tanpa direktori) dan karakter path dibuang.
    let safe_filename = filename
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("export")
        .trim()
        .replace("..", "_");
    let safe_filename = if safe_filename.is_empty() {
        "export".to_string()
    } else {
        safe_filename
    };

    let mut dialog = rfd::FileDialog::new().set_file_name(&safe_filename);

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    let downloads = std::path::Path::new(&home).join("Downloads");
    if downloads.exists() {
        dialog = dialog.set_directory(&downloads);
    }

    let path_ref = std::path::Path::new(&safe_filename);
    if let Some(ext) = path_ref.extension().and_then(|s| s.to_str()) {
        let ext_lower = ext.to_lowercase();
        match ext_lower.as_str() {
            "png" => {
                dialog = dialog.add_filter("Gambar PNG (*.png)", &["png"]);
            }
            "xlsx" => {
                dialog = dialog.add_filter("Excel Spreadsheet (*.xlsx)", &["xlsx"]);
            }
            "pdf" => {
                dialog = dialog.add_filter("Dokumen PDF (*.pdf)", &["pdf"]);
            }
            _ => {
                dialog = dialog.add_filter("File", &[&ext_lower]);
            }
        }
    }

    let selected_path = dialog.save_file();

    match selected_path {
        Some(path) => {
            // BUG FIX: `fs::write` adalah truncate-write — bila penulisan gagal
            // di tengah, file asli sudah rusak/hilang. Sekarang file ditulis ke
            // file sementara lalu di-rename (atomic-ish) supaya file lama tidak
            // pernah hilang kalau proses gagal.
            let tmp_path = path.with_extension(format!(
                "{}.part",
                path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("tmp")
            ));
            fs::write(&tmp_path, &data)
                .map_err(|e| format!("Gagal menulis file: {}", e))?;
            if let Err(e) = fs::rename(&tmp_path, &path) {
                let _ = fs::remove_file(&tmp_path);
                return Err(format!("Gagal menyimpan file: {}", e));
            }
            Ok(format!("File berhasil disimpan di: {}", path.display()))
        }
        None => Err("CANCELLED".to_string()),
    }
}

/// Mengirim teks struk sebagai byte ESC/POS langsung ke printer thermal via network (TCP Socket)
/// Default address: 127.0.0.1:9100 (kompatibel dengan virtual-thermal-printer dan printer thermal WiFi/LAN ESC/POS)
#[tauri::command]
pub fn print_to_network_printer(
    address: Option<String>,
    text: String,
) -> Result<String, String> {
    let addr_str = address
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            let conn = crate::local_db::get_conn().lock().unwrap();
            conn.query_row(
                "SELECT value FROM store_settings WHERE key = 'printer_network_address'",
                [],
                |r| r.get::<_, String>(0),
            ).ok()
        })
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "127.0.0.1:9100".to_string());

    let socket_addrs: Vec<_> = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Alamat printer tidak valid ({}): {}", addr_str, e))?
        .collect();

    if socket_addrs.is_empty() {
        return Err(format!("Alamat printer tidak ditemukan: {}", addr_str));
    }

    // BUG FIX: hanya mencoba `socket_addrs[0]`. Kalau IP pertama tidak
    // terjangkau padahal IP lain (mis. printer dengan 2 interface) bisa,
    // pencetakan gagal padahal printer sebenarnya aktif.
    // Sekarang mencoba SEMUA alamat yang di-resolve.
    let mut last_err: Option<String> = None;
    let mut stream: Option<TcpStream> = None;
    for sa in &socket_addrs {
        match TcpStream::connect_timeout(sa, Duration::from_secs(3)) {
            Ok(s) => {
                stream = Some(s);
                break;
            }
            Err(e) => {
                last_err = Some(format!("{}: {}", sa, e));
            }
        }
    }
    let mut stream = stream.ok_or_else(|| {
        format!(
            "Gagal terhubung ke {}. Pastikan virtual-thermal-printer atau printer thermal Anda aktif ({}): {}",
            addr_str,
            addr_str,
            last_err.unwrap_or_else(|| "tidak diketahui".to_string())
        )
    })?;

    // ESC/POS sequences:
    // 1. ESC @: Initialize printer
    let mut payload = Vec::new();
    payload.extend_from_slice(&[0x1b, 0x40]);

    // 2. Body Text (encoded as UTF-8 / ASCII)
    payload.extend_from_slice(text.as_bytes());

    // 3. Line feeds (3 baris kosong) + Paper Cut (GS V 0)
    payload.extend_from_slice(b"\n\n\n");
    payload.extend_from_slice(&[0x1d, 0x56, 0x00]);

    stream
        .write_all(&payload)
        .map_err(|e| format!("Gagal mengirim data ke printer: {}", e))?;
    stream
        .flush()
        .map_err(|e| format!("Gagal flush stream printer: {}", e))?;

    Ok(format!("Struk berhasil dikirim ke printer di {}", addr_str))
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BluetoothDevice {
    pub name: String,
    pub mac: String,
}

/// Mendapatkan daftar perangkat Bluetooth yang sudah ter-pairing di sistem
#[tauri::command]
pub fn get_bluetooth_devices() -> Result<Vec<BluetoothDevice>, String> {
    let output = std::process::Command::new("bluetoothctl")
        .arg("devices")
        .output()
        .map_err(|e| format!("Gagal menjalankan bluetoothctl: {}", e))?;

    // BUG FIX: exit status & stderr diabaikan. Kalau `bluetoothctl` gagal
    // (mis. daemon bluetooth tidak jalan) hasilnya list kosong dan aplikasi
    // menampilkan "Tidak ada perangkat Bluetooth yang terpasang" — pesan yang
    // menyesatkan. Sekarang error asli dikembalikan.
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let suffix = if stderr.is_empty() {
            ".".to_string()
        } else {
            format!(": {}", stderr)
        };
        return Err(format!("Gagal membaca daftar perangkat Bluetooth{}", suffix));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[0] == "Device" {
            let mac = parts[1].to_string();
            let name = parts[2..].join(" ");
            devices.push(BluetoothDevice { name, mac });
        }
    }

    Ok(devices)
}

/// Mengirim byte ESC/POS langsung ke printer thermal Bluetooth (RFCOMM SPP)
#[tauri::command]
pub fn print_to_bluetooth_printer(
    mac: Option<String>,
    channel: Option<u8>,
    text: String,
) -> Result<String, String> {
    let mac_target = match mac.filter(|m| !m.trim().is_empty()) {
        Some(m) => m,
        None => {
            let devices = get_bluetooth_devices()?;
            if let Some(first) = devices.first() {
                first.mac.clone()
            } else {
                return Err("Tidak ada perangkat Bluetooth yang terpasang / paired".into());
            }
        }
    };

    let ch = channel.unwrap_or(2);

    let py_script = r#"
import sys, socket
mac = sys.argv[1]
preferred_ch = int(sys.argv[2])
text = sys.stdin.read()
payload = b'\x1b@' + text.encode('utf-8') + b'\n\n\n\x1dV\x00'

channels = [preferred_ch] + [c for c in [1, 2, 3, 4] if c != preferred_ch]
last_err = None
success = False

for c in channels:
    try:
        s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
        s.settimeout(5.0)
        s.connect((mac, c))
        s.sendall(payload)
        s.close()
        success = True
        break
    except Exception as e:
        last_err = e

if not success:
    sys.stderr.write(f'Koneksi Bluetooth gagal: {last_err}')
    sys.exit(1)
"#;

    let mut child = std::process::Command::new("python3")
        .arg("-c")
        .arg(py_script)
        .arg(&mac_target)
        .arg(ch.to_string())
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Gagal memanggil Python Bluetooth handler: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Gagal menulis data struk: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Gagal menunggu proses Bluetooth: {}", e))?;

    if output.status.success() {
        Ok(format!("Struk berhasil dikirim ke Bluetooth ({})", mac_target))
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(err.trim().to_string())
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DetectedPrinterInfo {
    pub recommended_mode: String, // "usb" | "bluetooth" | "system"
    pub usb_available: bool,
    pub usb_device_path: Option<String>,
    pub bluetooth_available: bool,
    pub bluetooth_device_name: Option<String>,
    pub bluetooth_mac: Option<String>,
    pub status_text: String,
}

/// Mendeteksi printer yang aktif secara dinamis:
/// 1. Prioritas 1: USB Thermal Printer (/dev/usb/lp*)
/// 2. Prioritas 2: Bluetooth Printer yang sedang Connected: yes (BlueZ)
/// 3. Fallback: Dialog Cetak Sistem / PDF
#[tauri::command]
pub fn detect_printer_status() -> Result<DetectedPrinterInfo, String> {
    // 1. Cek USB Thermal Printer (/dev/usb/lp0, lp1, dll)
    let mut usb_available = false;
    let mut usb_device_path = None;

    for i in 0..4 {
        let path = format!("/dev/usb/lp{}", i);
        if std::path::Path::new(&path).exists() {
            usb_available = true;
            usb_device_path = Some(path);
            break;
        }
    }

    // 2. Cek Bluetooth Printer yang sedang terhubung aktif
    let mut bluetooth_available = false;
    let mut bluetooth_device_name = None;
    let mut bluetooth_mac = None;

    if let Ok(devices) = get_bluetooth_devices() {
        for dev in devices {
            if let Ok(info_out) = std::process::Command::new("bluetoothctl")
                .arg("info")
                .arg(&dev.mac)
                .output()
            {
                let info_str = String::from_utf8_lossy(&info_out.stdout);
                if info_str.contains("Connected: yes") {
                    bluetooth_available = true;
                    bluetooth_device_name = Some(dev.name);
                    bluetooth_mac = Some(dev.mac);
                    break;
                }
            }
        }
    }

    let (recommended_mode, status_text) = if usb_available {
        (
            "usb".to_string(),
            format!("Printer USB terdeteksi di {}", usb_device_path.as_deref().unwrap_or("")),
        )
    } else if bluetooth_available {
        (
            "bluetooth".to_string(),
            format!("Bluetooth aktif: {}", bluetooth_device_name.as_deref().unwrap_or("")),
        )
    } else {
        (
            "system".to_string(),
            "Tidak ada printer kasir terdeteksi (Gunakan Cetak PDF / Salin WA)".to_string(),
        )
    };

    Ok(DetectedPrinterInfo {
        recommended_mode,
        usb_available,
        usb_device_path,
        bluetooth_available,
        bluetooth_device_name,
        bluetooth_mac,
        status_text,
    })
}

/// Mencetak langsung teks ESC/POS ke printer USB (/dev/usb/lp0)
#[tauri::command]
pub fn print_to_usb_printer(
    device_path: Option<String>,
    text: String,
) -> Result<String, String> {
    let target = device_path.unwrap_or_else(|| "/dev/usb/lp0".to_string());

    // BUG FIX (keamanan): `device_path` datang langsung dari webview dan
    // sebelumnya dipakai tanpa validasi. `fs::write` adalah truncate-write,
    // jadi path arbitrer bisa menimpa file apa pun yang boleh ditulis user
    // (mis. ~/.bashrc, ~/.config/autostart/*.desktop, ~/Documents/invoice.xlsx).
    // Sekarang path WAJIB berada di bawah direktori perangkat printer.
    let target_path = std::path::Path::new(&target);
    if !target_path.is_absolute() {
        return Err("Path printer USB harus absolut (contoh: /dev/usb/lp0)".into());
    }
    let allowed_prefixes = ["/dev/usb/", "/dev/lp", "/dev/ttyUSB", "/dev/ttyACM"];
    if !allowed_prefixes.iter().any(|p| target.starts_with(p)) {
        return Err(format!(
            "Path printer USB '{}' tidak diizinkan. Hanya perangkat printer \
             (/dev/usb/lp*, /dev/lp*, /dev/ttyUSB*, /dev/ttyACM*) yang boleh ditulis.",
            target
        ));
    }
    // Tolak path yang mengandung komponen navigasi (../)
    if target_path.components().any(|c| c.as_os_str() == "..") {
        return Err("Path printer USB tidak valid".into());
    }

    let mut payload = Vec::new();
    payload.extend_from_slice(&[0x1b, 0x40]); // ESC @ (Init)
    payload.extend_from_slice(text.as_bytes());
    payload.extend_from_slice(b"\n\n\n");
    payload.extend_from_slice(&[0x1d, 0x56, 0x00]); // GS V 0 (Cut)

    std::fs::write(&target_path, payload)
        .map_err(|e| format!("Gagal mencetak ke printer USB di {}: {}", target, e))?;

    Ok(format!("Struk berhasil dikirim ke printer USB di {}", target))
}

/// BUG-014 FIX: Menghasilkan format cetak nota thermal (teks polos lebar 32 kolom,
/// siap dikirim ke printer thermal 58mm / ditempel ke driver cetak label) dari
/// data transaksi lengkap di Rust. Menerima objek transaction JSON dari frontend.
#[tauri::command]
pub fn generate_receipt_text(
    tx: serde_json::Value,
    store_name: Option<String>,
    paper_width: Option<String>,
) -> Result<String, String> {
    if !tx.is_object() {
        return Err("Data transaksi tidak valid".into());
    }

    let (paper_setting, store_address_setting, store_phone_setting, store_tagline_setting) = {
        let conn = crate::local_db::get_conn().lock().unwrap();
        let paper = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'receipt_paper_width'",
            [],
            |r| r.get::<_, String>(0),
        ).ok();
        let addr = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'store_address'",
            [],
            |r| r.get::<_, String>(0),
        ).ok();
        let phone = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'store_phone'",
            [],
            |r| r.get::<_, String>(0),
        ).ok();
        let tagline = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'store_tagline'",
            [],
            |r| r.get::<_, String>(0),
        ).ok();
        (paper, addr, phone, tagline)
    };

    let width = match paper_width.as_deref() {
        Some("80mm") => 42usize,
        Some("58mm") => 32usize,
        _ => {
            if paper_setting.as_deref() == Some("80mm") { 42usize } else { 32usize }
        }
    };
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
        .unwrap_or_else(|| "SIRKA".to_string())
        .to_uppercase();

    let customer_type = get_str("customerType");
    let is_b2c = customer_type == "B2C";
    let is_pre_order = get_bool("isPreOrder");
    let payment_status = get_str("paymentStatus");
    let payment_method = get_str("paymentMethod");

    // Helper alignment
    /// Potong teks agar tidak melebihi lebar kolom (mencegah kolom rusak
    /// saat nama barang / nama toko panjang).
    fn truncate(text: &str, max: usize) -> String {
        let count = text.chars().count();
        if count <= max {
            return text.to_string();
        }
        if max <= 1 {
            return "…".to_string();
        }
        let mut s: String = text.chars().take(max - 1).collect();
        s.push('…');
        s
    }
    fn row(left: &str, right: &str, width: usize) -> String {
        // BUG FIX: teks yang lebih panjang dari lebar kolom TIDAK dipotong ->
        // kolom thermal rusak dan subtotal tidak sejajar dengan itemnya.
        let right = truncate(right, width);
        let right_len = right.chars().count();
        let left = truncate(left, width.saturating_sub(right_len + 1));
        let l_len = left.chars().count();
        let r_len = right.chars().count();
        if l_len + r_len + 1 >= width {
            format!("{}\n{:>width$}", left, right, width = width)
        } else {
            let spaces = " ".repeat(width - l_len - r_len);
            format!("{}{}{}", left, spaces, right)
        }
    }
    let center = |text: &str| -> String {
        let text = truncate(text, width);
        let len = text.chars().count();
        let pad = if len < width { (width - len) / 2 } else { 0 };
        format!("{}{}", " ".repeat(pad), text)
    };

    let mut out = String::new();
    // Header (diposisikan di tengah kolom)
    let title = if is_b2c {
        "STRUK NOTA PENJUALAN"
    } else {
        "FAKTUR PENJUALAN B2B"
    };

    out.push_str(&center(&store));
    out.push('\n');

    if let Some(tagline) = store_tagline_setting.filter(|s| !s.trim().is_empty()) {
        out.push_str(&center(&tagline));
        out.push('\n');
    }
    if let Some(addr) = store_address_setting.filter(|s| !s.trim().is_empty()) {
        for line in addr.lines() {
            let line = line.trim();
            if !line.is_empty() {
                out.push_str(&center(line));
                out.push('\n');
            }
        }
    }
    if let Some(phone) = store_phone_setting.filter(|s| !s.trim().is_empty()) {
        let phone_str = format!("WA / Telp: {}", phone.trim());
        out.push_str(&center(&phone_str));
        out.push('\n');
    }

    out.push_str(&center(title));
    out.push('\n');
    out.push_str(&equals);
    out.push('\n');
    out.push_str(&row("No", get_str("invoiceNo").as_str(), width));
    out.push('\n');
    out.push_str(&row("Tgl", get_str("date").as_str(), width));
    out.push('\n');
    // BUG FIX: label "Pembeli " punya spasi di akhir sedangkan "Pelanggan"
    // tidak -> nama pelanggan B2B mulai satu kolom lebih kanan dibanding B2C.
    let buyer_label = if is_b2c { "Pelanggan" } else { "Pembeli" };
    out.push_str(&row(buyer_label, get_str("buyer").as_str(), width));
    out.push('\n');
    // BUG FIX: metode bayar kosong membuat struk tercetak "LUNAS ()".
    let status_text = if payment_method.trim().is_empty() {
        payment_status.clone()
    } else {
        format!("{} ({})", payment_status, payment_method)
    };
    out.push_str(&row("Status", &status_text, width));
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
            // BUG FIX: qty dibulatkan ke 1 desimal sehingga penjualan 0,125 KG
            // tercetak "0.1 KG" dan 2,25 KG tercetak "2.2" (round-half-to-even)
            // — padahal total dihitung dari qty persisnya. Pelanggan menerima
            // struk berisi jumlah yang tidak pernah terjual.
            // Sekarang 3 desimal dengan trailing zero dibuang.
            let qty_txt = format_qty(qty);
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

    // BUG FIX: struk thermal sebelumnya TIDAK menampilkan kembalian, infaq,
    // maupun rincian split payment — padahal struk HTML/WhatsApp menampilkannya.
    // Akibatnya pelanggan tidak tahu berapa kembalian yang diterima dan kasir
    // tidak punya bukti nominal infaq yang masuk kotak amal.
    let change_amount = get_num("changeAmount");
    if change_amount > 0.0 {
        out.push_str(&row("Kembalian", &format!("Rp {}", fmt_rp(change_amount)), width));
        out.push('\n');
    }
    let infaq_amount = get_num("infaqAmount");
    if infaq_amount > 0.0 {
        out.push_str(&row("Infaq/Kotak Amal", &format!("Rp {}", fmt_rp(infaq_amount)), width));
        out.push('\n');
    }
    if get_bool("isSplitPayment") {
        let cash_amt = get_num("cashAmount");
        let non_cash_amt = get_num("nonCashAmount");
        let non_cash_method = get_str("nonCashMethod");
        out.push_str(&row(
            "Bayar Campur",
            &format!("Tunai {} + {} {}", fmt_rp(cash_amt), fmt_rp(non_cash_amt), non_cash_method),
            width,
        ));
        out.push('\n');
    }

    let points_earned = get_num("pointsEarned");
    if points_earned > 0.0 {
        out.push_str(&row("Poin Didapat", &format!("+{}", points_earned.round() as i64), width));
        out.push('\n');
    }

    // Barcode Faktur Transaksi
    let invoice_no = get_str("invoiceNo");
    out.push_str(&dashes);
    out.push('\n');
    out.push_str(&center("||| | |||| ||| ||||| |||| ||"));
    out.push('\n');
    out.push_str(&center(&format!("* {} *", invoice_no)));
    out.push('\n');

    out.push_str(&dashes);
    out.push('\n');
    if is_pre_order {
        out.push_str("Ket: Sesuai nota pesanan\n");
    } else if payment_status == "TEMPO" {
        out.push_str("Ket: BON / TEMPO (Piutang)\n");
    } else {
        out.push_str("Terima kasih. LUNAS penuh.\n");
    }

    if !is_b2c {
        out.push('\n');
        out.push_str(&center("TANDA TERIMA PENGIRIMAN"));
        out.push('\n');
        // BUG FIX: blok ini sebelumnya hard-coded untuk lebar 32 kolom sehingga
        // tidak sejajar di kertas 42 kolom (80mm).
        let half = width / 2;
        out.push_str(&format!(
            "{:<width$}{:<width$}\n",
            "Penerima:",
            "Pengirim:",
            width = half
        ));
        out.push_str(&format!(
            "{:<width$}{:<width$}\n",
            "(..................)",
            "(..................)",
            width = half
        ));
    }

    Ok(out)
}

/// Format jumlah (qty) untuk struk thermal.
///
/// BUG FIX: format lama memakai 1 desimal sehingga 0,125 KG tercetak "0.1"
/// dan 2,25 KG tercetak "2.2" (round-half-to-even) — jumlah yang tidak pernah
/// terjual. Sekarang 3 desimal dengan trailing zero dibuang.
fn format_qty(qty: f64) -> String {
    if !qty.is_finite() {
        return "0".to_string();
    }
    let rounded = (qty * 1000.0).round() / 1000.0;
    if (rounded - rounded.trunc()).abs() < f64::EPSILON {
        return format!("{}", rounded as i64);
    }
    let s = format!("{:.3}", rounded);
    let s = s.trim_end_matches('0').trim_end_matches('.').to_string();
    s
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

#[tauri::command]
pub fn db_get_sync_status() -> Result<crate::sync::SyncStatusInfo, String> {
    Ok(crate::sync::get_status())
}

#[tauri::command]
pub async fn db_trigger_sync() -> Result<crate::sync::SyncStatusInfo, String> {
    let res = crate::sync::run_sync_cycle_force().await;
    let status = crate::sync::get_status();
    match res {
        Ok(_) => Ok(status),
        Err(e) => Err(format!("Sinkronisasi gagal: {}", e)),
    }
}

#[tauri::command]
pub async fn db_reset_cache() -> Result<crate::sync::SyncStatusInfo, String> {
    crate::sync::reset_cache_and_resync().await
}

#[tauri::command]
pub async fn db_wipe_all_data(wipe_cloud: bool) -> Result<crate::sync::SyncStatusInfo, String> {
    crate::sync::wipe_all_data(wipe_cloud).await
}

/// BUG FIX: antrean outbox harus bisa diisi langsung dari sisi frontend.
///
/// Sebelumnya `syncService.enqueue()` di frontend hanya memanggil `triggerSync()`
/// tanpa menulis apa pun ke outbox. Akibatnya semua fallback "offline" pada
/// store (transaksi, pembeli, pre-order, kulakan, produk) membuang data begitu
/// perintah database gagal — data tidak pernah tersimpan di SQLite maupun PG.
///
/// Perintah ini menulis payload apa pun ke tabel `sync_outbox` sehingga data
/// tetap tersimpan lokal dan terkirim ke cloud saat koneksi kembali.
#[tauri::command]
pub fn db_enqueue_outbox(action: String, payload: serde_json::Value) -> Result<i64, String> {
    let conn = crate::local_db::get_conn().lock().unwrap();
    crate::local_db::enqueue_outbox(&conn, &action, &payload).map_err(|e| e.to_string())
}


