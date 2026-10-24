use crate::local_db::{
    get_conn, local_create_transaction, local_delete_transaction, local_get_transactions,
    local_update_transaction_status,
};
use crate::models::TransactionRecord;

#[tauri::command]
pub async fn db_get_transactions() -> Result<Vec<TransactionRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let txs = local_get_transactions(&conn).map_err(|e| e.to_string())?;
    Ok(txs)
}

#[tauri::command]
pub async fn db_create_transaction(
    tx: TransactionRecord,
    member_id: Option<String>,
) -> Result<String, String> {
    let invoice_no = {
        let mut conn = get_conn().lock().unwrap();
        local_create_transaction(&mut conn, &tx, member_id.as_deref())
            .map_err(|e| format!("Gagal mencatat transaksi di database lokal: {}", e))?;
        tx.invoice_no
    };

    // Trigger background sync ke PostgreSQL Cloud secara non-blocking
    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(invoice_no)
}

#[tauri::command]
pub async fn db_update_transaction_status(
    id: String,
    payment_status: String,
) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_update_transaction_status(&conn, &id, &payment_status)
            .map_err(|e| format!("Gagal update status transaksi di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_delete_transaction(id: String) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        local_delete_transaction(&mut conn, &id)
            .map_err(|e| format!("Gagal menghapus transaksi di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

