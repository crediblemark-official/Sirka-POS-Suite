use serde::{Deserialize, Serialize};
use crate::db::get_pg_client;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FinancialReport {
    #[serde(rename = "periodLabel")]
    pub period_label: String,
    #[serde(rename = "grossSales")]
    pub gross_sales: f64,
    pub discounts: f64,
    #[serde(rename = "netSales")]
    pub net_sales: f64,
    pub cogs: f64,
    #[serde(rename = "grossProfit")]
    pub gross_profit: f64,
    #[serde(rename = "profitMarginPercent")]
    pub profit_margin_percent: f64,
    #[serde(rename = "cashInflow")]
    pub cash_inflow: f64,
    #[serde(rename = "transferInflow")]
    pub transfer_inflow: f64,
    #[serde(rename = "cashOutflowPurchases")]
    pub cash_outflow_purchases: f64,
    #[serde(rename = "netCashFlow")]
    pub net_cash_flow: f64,
    #[serde(rename = "pendingReceivables")]
    pub pending_receivables: f64,
    #[serde(rename = "inventoryAssetValue")]
    pub inventory_asset_value: f64,
    #[serde(rename = "totalTransactions")]
    pub total_transactions: i64,
    #[serde(rename = "averageTicketSize")]
    pub average_ticket_size: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SaleItem {
    pub id: String,
    pub name: String,
    pub qty: f64,
    pub unit: String,
    #[serde(rename = "sellPrice")]
    pub sell_price: f64,
    pub subtotal: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SaleTransaction {
    pub id: String,
    #[serde(rename = "invoiceNo")]
    pub invoice_no: String,
    pub date: String,
    pub time: String,
    pub buyer: String,
    pub market: String,
    #[serde(rename = "totalAmount")]
    pub total_amount: f64,
    pub cogs: f64,
    pub profit: f64,
    #[serde(rename = "paymentMethod")]
    pub payment_method: String,
    #[serde(rename = "paymentStatus")]
    pub payment_status: String,
    #[serde(rename = "itemsCount")]
    pub items_count: i64,
    pub items: Vec<SaleItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StockValuationItem {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category: String,
    pub stock: f64,
    pub unit: String,
    #[serde(rename = "buyPrice")]
    pub buy_price: f64,
    #[serde(rename = "sellPrice")]
    pub sell_price: f64,
    #[serde(rename = "assetValue")]
    pub asset_value: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PurchaseReceipt {
    pub id: String,
    #[serde(rename = "invoiceNo")]
    pub invoice_no: String,
    pub date: String,
    pub supplier: String,
    #[serde(rename = "totalBuy")]
    pub total_buy: f64,
    #[serde(rename = "itemCount")]
    pub item_count: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ConnResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn get_owner_financial_report(period: Option<String>) -> Result<FinancialReport, String> {
    let client = get_pg_client(None).await?;
    let p = period.unwrap_or_else(|| "month".to_string());

    let (where_clause, pur_clause, label) = match p.as_str() {
        "today" => (
            "date = CURRENT_DATE".to_string(),
            "date = to_char(CURRENT_DATE, 'YYYY-MM-DD')".to_string(),
            "Hari Ini".to_string()
        ),
        "week" => (
            "date >= CURRENT_DATE - INTERVAL '7 days'".to_string(),
            "date >= to_char(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')".to_string(),
            "7 Hari Terakhir".to_string()
        ),
        "year" => (
            "date >= date_trunc('year', CURRENT_DATE)".to_string(),
            "date >= to_char(date_trunc('year', CURRENT_DATE), 'YYYY-MM-DD')".to_string(),
            "Tahun Ini".to_string()
        ),
        _ => (
            "date >= date_trunc('month', CURRENT_DATE)".to_string(),
            "date >= to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')".to_string(),
            "Bulan Berjalan".to_string()
        ),
    };

    let query_sales = format!(
        "SELECT 
            COALESCE(SUM(total_sell), 0)::float8 as gross_sales,
            COALESCE(SUM(COALESCE(discount_amount, 0)), 0)::float8 as discounts,
            COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as net_sales,
            COALESCE(SUM(total_buy), 0)::float8 as cogs,
            COALESCE(SUM(total_profit), 0)::float8 as gross_profit,
            COALESCE(SUM(CASE WHEN payment_method = 'Tunai' THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as cash_in,
            COALESCE(SUM(CASE WHEN payment_method != 'Tunai' AND payment_status = 'Lunas' THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as transfer_in,
            COUNT(*)::int8 as tx_count
         FROM transactions
         WHERE {}",
        where_clause
    );

    let row = client.query_one(&query_sales, &[]).await
        .map_err(|e| format!("Query laporan penjualan gagal: {}", e))?;

    let gross_sales: f64 = row.get(0);
    let discounts: f64 = row.get(1);
    let net_sales: f64 = row.get(2);
    let cogs: f64 = row.get(3);
    let gross_profit: f64 = row.get(4);
    let cash_inflow: f64 = row.get(5);
    let transfer_inflow: f64 = row.get(6);
    let total_transactions: i64 = row.get(7);

    let profit_margin_percent = if net_sales > 0.0 {
        (gross_profit / net_sales) * 100.0
    } else {
        0.0
    };

    let average_ticket_size = if total_transactions > 0 {
        net_sales / (total_transactions as f64)
    } else {
        0.0
    };

    // Query pending receivables
    let row_rec = client.query_one(
        "SELECT COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8
         FROM transactions
         WHERE payment_status = 'Tempo' OR payment_status = 'Belum Lunas'",
        &[]
    ).await.map_err(|e| format!("Query piutang tempo gagal: {}", e))?;
    let pending_receivables: f64 = row_rec.get(0);

    // Query inventory asset value
    let row_inv = client.query_one(
        "SELECT COALESCE(SUM(stock * last_buy_price), 0)::float8 FROM products",
        &[]
    ).await.map_err(|e| format!("Query nilai persediaan gagal: {}", e))?;
    let inventory_asset_value: f64 = row_inv.get(0);

    // Query purchases
    let query_purchases = format!(
        "SELECT COALESCE(SUM(total_buy), 0)::float8 FROM purchase_receipts WHERE {}",
        pur_clause
    );
    let row_pur = client.query_one(&query_purchases, &[]).await.unwrap_or(row_rec);
    let cash_outflow_purchases: f64 = row_pur.get(0);

    let net_cash_flow = (cash_inflow + transfer_inflow) - cash_outflow_purchases;

    Ok(FinancialReport {
        period_label: label,
        gross_sales,
        discounts,
        net_sales,
        cogs,
        gross_profit,
        profit_margin_percent,
        cash_inflow,
        transfer_inflow,
        cash_outflow_purchases,
        net_cash_flow,
        pending_receivables,
        inventory_asset_value,
        total_transactions,
        average_ticket_size,
    })
}

#[tauri::command]
pub async fn get_owner_inventory_valuation() -> Result<Vec<StockValuationItem>, String> {
    let client = get_pg_client(None).await?;

    let rows = client.query(
        "SELECT id, code, name, category, stock::float8, unit, last_buy_price::float8, last_sell_price::float8, (stock * last_buy_price)::float8
         FROM products
         ORDER BY (stock * last_buy_price) DESC
         LIMIT 150",
        &[]
    ).await.map_err(|e| format!("Query valuasi stok gagal: {}", e))?;

    let mut list = Vec::new();
    for row in rows {
        list.push(StockValuationItem {
            id: row.get(0),
            code: row.get(1),
            name: row.get(2),
            category: row.get(3),
            stock: row.get(4),
            unit: row.get(5),
            buy_price: row.get(6),
            sell_price: row.get(7),
            asset_value: row.get(8),
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn get_owner_sales(_filter: Option<serde_json::Value>) -> Result<Vec<SaleTransaction>, String> {
    let client = get_pg_client(None).await?;

    let query = "
        SELECT 
            id,
            COALESCE(invoice_no, ''),
            COALESCE(date, ''),
            COALESCE(buyer, 'Umum'),
            COALESCE(customer_type, 'B2C'),
            COALESCE(final_total, total_sell)::float8,
            COALESCE(total_buy, 0)::float8,
            COALESCE(total_profit, 0)::float8,
            COALESCE(payment_method, 'Tunai'),
            COALESCE(payment_status, 'Lunas'),
            items,
            to_char(created_at, 'HH24:MI')
        FROM transactions
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 100
    ";

    let rows = client.query(query, &[]).await
        .map_err(|e| format!("Query transaksi penjualan gagal: {}", e))?;

    let mut list = Vec::new();
    for row in rows {
        let id: String = row.get(0);
        let invoice_no: String = row.get(1);
        let date: String = row.get(2);
        let buyer: String = row.get(3);
        let market: String = row.get(4);
        let total_amount: f64 = row.get(5);
        let cogs: f64 = row.get(6);
        let profit: f64 = row.get(7);
        let payment_method: String = row.get(8);
        let payment_status: String = row.get(9);
        let items_val: Option<serde_json::Value> = row.get(10);
        let time_str: Option<String> = row.get(11);

        let mut parsed_items = Vec::new();
        if let Some(serde_json::Value::Array(arr)) = items_val {
            for it in arr {
                parsed_items.push(SaleItem {
                    id: it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    name: it.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    qty: it.get("qty").and_then(|v| v.as_f64()).unwrap_or(1.0),
                    unit: it.get("unit").and_then(|v| v.as_str()).unwrap_or("pcs").to_string(),
                    sell_price: it.get("sellPrice").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    subtotal: it.get("subtotal").and_then(|v| v.as_f64()).unwrap_or(0.0),
                });
            }
        }

        let items_count = parsed_items.len() as i64;

        list.push(SaleTransaction {
            id,
            invoice_no,
            date,
            time: time_str.unwrap_or_else(|| "00:00".to_string()),
            buyer,
            market,
            total_amount,
            cogs,
            profit,
            payment_method,
            payment_status,
            items_count,
            items: parsed_items,
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn get_owner_purchases() -> Result<Vec<PurchaseReceipt>, String> {
    let client = get_pg_client(None).await?;

    let rows = client.query(
        "SELECT 
            id,
            COALESCE(supplier_invoice_no, id),
            COALESCE(date, ''),
            COALESCE(supplier, 'Umum'),
            COALESCE(total_buy, 0)::float8
         FROM purchase_receipts
         ORDER BY date DESC NULLS LAST, id DESC
         LIMIT 50",
        &[]
    ).await.map_err(|e| format!("Query riwayat kulakan gagal: {}", e))?;

    let mut list = Vec::new();
    for row in rows {
        list.push(PurchaseReceipt {
            id: row.get(0),
            invoice_no: row.get(1),
            date: row.get(2),
            supplier: row.get(3),
            total_buy: row.get(4),
            item_count: 0,
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn test_owner_db_connection(url: Option<String>) -> Result<ConnResult, String> {
    match get_pg_client(url).await {
        Ok(client) => {
            match client.simple_query("SELECT 1;").await {
                Ok(_) => Ok(ConnResult {
                    success: true,
                    message: "Berhasil terhubung ke server database PostgreSQL".to_string(),
                }),
                Err(e) => Ok(ConnResult {
                    success: false,
                    message: format!("Query gagal: {}", e),
                })
            }
        }
        Err(e) => Ok(ConnResult {
            success: false,
            message: e,
        })
    }
}
