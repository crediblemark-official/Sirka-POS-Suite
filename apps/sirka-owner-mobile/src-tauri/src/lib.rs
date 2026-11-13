mod db;
mod commands;
mod tls;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_owner_financial_report,
            get_owner_inventory_valuation,
            get_owner_sales,
            get_owner_purchases,
            get_owner_products_intelligence,
            get_owner_sales_patterns,
            get_owner_receivables_aging,
            get_owner_shifts,
            get_owner_settings,
            test_owner_db_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
