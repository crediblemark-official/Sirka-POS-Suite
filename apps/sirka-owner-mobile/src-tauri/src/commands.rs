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
pub async fn get_owner_financial_report(period: Option<String>, url: Option<String>) -> Result<FinancialReport, String> {
    let client = get_pg_client(url).await?;
    let p = period.unwrap_or_else(|| "month".to_string());

    // BUG FIX (konsistensi periode & timezone): definisi periode harus sama
    // dengan aplikasi desktop & Cloudflare Worker, dan batas periode harus
    // dihitung pada zona waktu toko ('Asia/Jakarta'), bukan zona server
    // PostgreSQL (biasanya UTC) yang membuat "Hari Ini" salah selama 7 jam
    // pertama setiap hari.
    const TZ: &str = "'Asia/Jakarta'";
    let (where_clause, pur_clause, label) = match p.as_str() {
        "today" => (
            format!("date = (NOW() AT TIME ZONE {})::date", TZ),
            format!("date = to_char((NOW() AT TIME ZONE {})::date, 'YYYY-MM-DD')", TZ),
            "Hari Ini".to_string()
        ),
        "week" => (
            format!("date >= (NOW() AT TIME ZONE {})::date - INTERVAL '7 days'", TZ),
            format!(
                "date >= to_char((NOW() AT TIME ZONE {})::date - INTERVAL '7 days', 'YYYY-MM-DD')",
                TZ
            ),
            "8 Hari Terakhir".to_string()
        ),
        "year" => (
            format!("date >= ((NOW() AT TIME ZONE {})::date - INTERVAL '1 year')", TZ),
            format!(
                "date >= to_char((NOW() AT TIME ZONE {})::date - INTERVAL '1 year', 'YYYY-MM-DD')",
                TZ
            ),
            "1 Tahun Terakhir".to_string()
        ),
        _ => (
            format!(
                "(date >= (date_trunc('month', NOW() AT TIME ZONE {})::date - INTERVAL '1 month') AND date <= (NOW() AT TIME ZONE {})::date)",
                TZ, TZ
            ),
            format!(
                "(date >= to_char((date_trunc('month', NOW() AT TIME ZONE {})::date - INTERVAL '1 month'), 'YYYY-MM-DD') AND date <= to_char((NOW() AT TIME ZONE {})::date, 'YYYY-MM-DD'))",
                TZ, TZ
            ),
            "30 Hari Terakhir".to_string()
        ),
    };

    let query_sales = format!(
        "SELECT
            COALESCE(SUM(total_sell), 0)::float8 as gross_sales,
            COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(points_discount, 0)), 0)::float8 as discounts,
            COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8 as net_sales,
            COALESCE(SUM(total_buy), 0)::float8 as cogs,
            COALESCE(SUM(total_profit), 0)::float8 as gross_profit,
            COALESCE(SUM(CASE
                WHEN UPPER(payment_method) IN ('TUNAI', 'TUNAI / KAS', 'CASH')
                     AND UPPER(COALESCE(payment_status, 'LUNAS')) = 'LUNAS'
                THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as cash_in,
            COALESCE(SUM(CASE
                WHEN UPPER(payment_method) NOT IN ('TUNAI', 'TUNAI / KAS', 'CASH', 'NOTA TEMPO')
                     AND UPPER(COALESCE(payment_status, 'LUNAS')) = 'LUNAS'
                THEN COALESCE(final_total, total_sell) ELSE 0 END), 0)::float8 as transfer_in,
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
    // BUG FIX: nilai di database adalah 'TEMPO' (upper case) sehingga filter
    // 'Tempo' tidak pernah cocok -> total piutang selalu 0.
    let row_rec = client.query_one(
        "SELECT COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8
         FROM transactions
         WHERE UPPER(COALESCE(payment_status, 'LUNAS')) IN ('TEMPO', 'BELUM LUNAS', 'UNPAID')",
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
    // BUG FIX: sebelumnya `unwrap_or(row_rec)` memakai baris PIUTANG sebagai
    // fallback bila query pembelian gagal -> arus kas menampilkan outflow
    // sebesar total piutang. Sekarang error diteruskan dengan jelas.
    let query_purchases = format!(
        "SELECT COALESCE(SUM(total_buy), 0)::float8 FROM purchase_receipts WHERE {}",
        pur_clause
    );
    let row_pur = client.query_one(&query_purchases, &[]).await
        .map_err(|e| format!("Query nilai pembelian gagal: {}", e))?;
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
pub async fn get_owner_inventory_valuation(url: Option<String>) -> Result<Vec<StockValuationItem>, String> {
    let client = get_pg_client(url).await?;

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
pub async fn get_owner_sales(filter: Option<serde_json::Value>, url: Option<String>) -> Result<Vec<SaleTransaction>, String> {
    let client = get_pg_client(url).await?;

    // BUG FIX: filter (rentang tanggal & status) sebelumnya DIABAIKAN
    // (parameter `_filter` dibuang) sehingga endpoint selalu mengembalikan 100
    // transaksi terakhir tanpa regard filter apa pun.
    let mut conditions: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();
    if let Some(f) = filter.as_ref() {
        if let Some(range) = f.get("dateRange").and_then(|v| v.as_str()) {
            if range.chars().all(|c| c.is_ascii_digit()) && !range.is_empty() {
                values.push(range.to_string());
                // BUG FIX: CURRENT_DATE memakai zona waktu SERVER (UTC) ->
                // window "7 hari" bergeser 7 jam di WIB.
                conditions.push(format!(
                    "date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - (${} || ' days')::interval",
                    values.len()
                ));
            } else if range.len() == 10 && range.as_bytes()[4] == b'-' {
                values.push(range.to_string());
                conditions.push(format!("date >= ${}::date", values.len()));
            }
        }
        // BUG FIX: batas atas rentang tanggal (dateTo) — sebelumnya hanya ada
        // batas bawah sehingga "rentang" berarti "dari X sampai sekarang".
        if let Some(to) = f.get("dateTo").and_then(|v| v.as_str()) {
            if to.len() == 10 && to.as_bytes()[4] == b'-' {
                values.push(to.to_string());
                conditions.push(format!("date <= ${}::date", values.len()));
            }
        }
        if let Some(status) = f.get("status").and_then(|v| v.as_str()) {
            let s = status.to_uppercase();
            // BUG FIX: filter status apa pun selain LUNAS dipetakan ke TEMPO
            // (bug yang sama sudah diperbaiki di Worker) -> hasil baris berbeda
            // tergantung apakah app bicara ke Worker atau ke PG langsung.
            if s == "LUNAS" || s == "TEMPO" {
                values.push(s.clone());
                conditions.push(format!(
                    "UPPER(COALESCE(payment_status, 'LUNAS')) = ${}",
                    values.len()
                ));
            }
        }
    }
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // BUG FIX: `COALESCE(date, '')` pada kolom DATE membuat PostgreSQL
    //hani "invalid input syntax for type date: \"\"" karena tipe common-nya
    // date. Kolomnya NOT NULL jadi COALESCE tidak perlu; cukup `date::text`.
    let query = format!(
        "SELECT
            id,
            COALESCE(invoice_no, ''),
            date::text,
            COALESCE(buyer, 'Umum'),
            COALESCE(customer_type, 'B2C'),
            COALESCE(final_total, total_sell)::float8,
            COALESCE(total_buy, 0)::float8,
            COALESCE(total_profit, 0)::float8,
            COALESCE(payment_method, 'Tunai / Kas'),
            UPPER(COALESCE(payment_status, 'LUNAS')),
            items,
            to_char(created_at, 'HH24:MI')
        FROM transactions
        {}
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 100",
        where_clause
    );

    // Konversi ke slice parameter yang bisa dikirim ke tokio-postgres
    let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = values
        .iter()
        .map(|v| v as &(dyn tokio_postgres::types::ToSql + Sync))
        .collect();
    let rows = client.query(query.as_str(), &params).await
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
                    // BUG FIX: nama field di database adalah `subtotalSell`
                    // (src/types/index.ts) — `subtotal` tidak pernah ada
                    // sehingga setiap baris faktur tampil Rp 0.
                    subtotal: it
                        .get("subtotalSell")
                        .or_else(|| it.get("subtotal"))
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0),
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
pub async fn get_owner_purchases(url: Option<String>) -> Result<Vec<PurchaseReceipt>, String> {
    let client = get_pg_client(url).await?;

    let rows = client.query(
        "SELECT
            r.id,
            COALESCE(r.supplier_invoice_no, r.id),
            COALESCE(r.date, ''),
            COALESCE(r.supplier, 'Umum'),
            COALESCE(r.total_buy, 0)::float8,
            COALESCE(i.item_count, 0)::int8
         FROM purchase_receipts r
         LEFT JOIN (
             SELECT receipt_id, COUNT(*) as item_count
             FROM purchase_receipt_items
             GROUP BY receipt_id
         ) i ON i.receipt_id = r.id
         ORDER BY r.date DESC NULLS LAST, r.id DESC
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
            // BUG FIX: item_count sebelumnya hard-coded 0 -> mobile selalu
            // menampilkan "0 macam barang". Dihitung dari tabel
            // purchase_receipt_items (sama seperti versi Worker).
            item_count: row.get(5),
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductIntelligenceItem {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category: String,
    pub unit: String,
    pub stock: f64,
    #[serde(rename = "buyPrice")]
    pub buy_price: f64,
    #[serde(rename = "sellPrice")]
    pub sell_price: f64,
    #[serde(rename = "capitalLocked")]
    pub capital_locked: f64,
    #[serde(rename = "sold30d")]
    pub sold_30d: f64,
    #[serde(rename = "revenue30d")]
    pub revenue_30d: f64,
    #[serde(rename = "profit30d")]
    pub profit_30d: f64,
    #[serde(rename = "marginPct")]
    pub margin_pct: f64,
    #[serde(rename = "velocityStatus")]
    pub velocity_status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductsIntelligenceReport {
    #[serde(rename = "totalCapitalLocked")]
    pub total_capital_locked: f64,
    #[serde(rename = "totalDeadStockSkus")]
    pub total_dead_stock_skus: i64,
    #[serde(rename = "fastMovingSkus")]
    pub fast_moving_skus: i64,
    pub items: Vec<ProductIntelligenceItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HourlyPattern {
    pub hour: i32,
    #[serde(rename = "txCount")]
    pub tx_count: i32,
    pub revenue: f64,
    pub aov: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DayPattern {
    #[serde(rename = "dayName")]
    pub day_name: String,
    pub dow: i32,
    #[serde(rename = "txCount")]
    pub tx_count: i32,
    pub revenue: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SalesPatternsReport {
    #[serde(rename = "totalTransactions")]
    pub total_transactions: i64,
    #[serde(rename = "totalSales")]
    pub total_sales: f64,
    #[serde(rename = "averageTicket")]
    pub average_ticket: f64,
    pub hourly: Vec<HourlyPattern>,
    pub days: Vec<DayPattern>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceivableAgingItem {
    pub id: String,
    #[serde(rename = "invoiceNo")]
    pub invoice_no: String,
    pub buyer: String,
    pub date: String,
    pub amount: f64,
    #[serde(rename = "ageDays")]
    pub age_days: i32,
    #[serde(rename = "agingBucket")]
    pub aging_bucket: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceivablesAgingReport {
    #[serde(rename = "totalPending")]
    pub total_pending: f64,
    #[serde(rename = "totalInvoices")]
    pub total_invoices: i64,
    #[serde(rename = "bucket0_7")]
    pub bucket_0_7: f64,
    #[serde(rename = "bucket8_14")]
    pub bucket_8_14: f64,
    #[serde(rename = "bucket15_30")]
    pub bucket_15_30: f64,
    #[serde(rename = "bucketOver30")]
    pub bucket_over_30: f64,
    pub items: Vec<ReceivableAgingItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CashierShift {
    pub id: String,
    #[serde(rename = "cashierName")]
    pub cashier_name: String,
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: Option<String>,
    #[serde(rename = "startingCash")]
    pub starting_cash: f64,
    #[serde(rename = "cashSales")]
    pub cash_sales: f64,
    #[serde(rename = "nonCashSales")]
    pub non_cash_sales: f64,
    #[serde(rename = "cashOutflow")]
    pub cash_outflow: f64,
    #[serde(rename = "cashInflow")]
    pub cash_inflow: f64,
    #[serde(rename = "refundOutflow")]
    pub refund_outflow: f64,
    #[serde(rename = "transferredToTreasury")]
    pub transferred_to_treasury: f64,
    #[serde(rename = "retainedInDrawer")]
    pub retained_in_drawer: f64,
    #[serde(rename = "expectedCash")]
    pub expected_cash: f64,
    #[serde(rename = "actualCash")]
    pub actual_cash: f64,
    pub discrepancy: f64,
    pub notes: Option<String>,
    pub status: String,
}

#[tauri::command]
pub async fn get_owner_products_intelligence(url: Option<String>) -> Result<ProductsIntelligenceReport, String> {
    let client = get_pg_client(url).await?;
    let rows = client.query(
        r#"
        WITH item_sales AS (
          SELECT
            NULLIF(COALESCE(it.item->>'productId', it.item->>'code'), '') as product_id,
            SUM(CASE
              WHEN (it.item->>'baseQty') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (it.item->>'baseQty')::numeric
              WHEN (it.item->>'qty') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (it.item->>'qty')::numeric ELSE 0 END) as sold_qty,
            SUM(CASE WHEN (it.item->>'subtotalSell') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'subtotalSell')::numeric
                     WHEN (it.item->>'subtotal') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'subtotal')::numeric ELSE 0 END) as revenue,
            SUM(CASE WHEN (it.item->>'profit') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (it.item->>'profit')::numeric ELSE 0 END) as profit
          FROM transactions t
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END
          ) AS it(item)
          WHERE t.date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
          GROUP BY NULLIF(COALESCE(it.item->>'productId', it.item->>'code'), '')
        )
        SELECT
          p.id, COALESCE(p.code, ''), COALESCE(p.name, ''), COALESCE(p.category, ''), COALESCE(p.unit, 'pcs'),
          COALESCE(p.stock, 0)::float8,
          COALESCE(p.last_buy_price, 0)::float8,
          COALESCE(p.last_sell_price, 0)::float8,
          COALESCE(p.stock * p.last_buy_price, 0)::float8,
          COALESCE(s.sold_qty, 0)::float8,
          COALESCE(s.revenue, 0)::float8,
          COALESCE(s.profit, 0)::float8,
          CASE
            WHEN p.last_sell_price > 0 THEN (((p.last_sell_price - p.last_buy_price) / p.last_sell_price) * 100)::float8
            ELSE 0::float8
          END,
          CASE
            WHEN COALESCE(s.sold_qty, 0) = 0 AND p.stock > 0 THEN 'DEAD_STOCK'
            WHEN COALESCE(s.sold_qty, 0) >= 10 THEN 'FAST_MOVING'
            ELSE 'SLOW_MOVING'
          END
        FROM products p
        LEFT JOIN item_sales s ON p.id = s.product_id
        ORDER BY (p.stock * p.last_buy_price) DESC
        LIMIT 500
        "#,
        &[],
    ).await.map_err(|e| format!("Query intelijen produk gagal: {}", e))?;

    let mut total_capital_locked = 0.0_f64;
    let mut total_dead_stock_skus = 0_i64;
    let mut fast_moving_skus = 0_i64;
    let mut items = Vec::with_capacity(rows.len());

    for row in rows {
        let capital_locked: f64 = row.get(8);
        let velocity_status: String = row.get(13);
        if velocity_status == "DEAD_STOCK" {
            total_capital_locked += capital_locked;
            total_dead_stock_skus += 1;
        } else if velocity_status == "FAST_MOVING" {
            fast_moving_skus += 1;
        }
        items.push(ProductIntelligenceItem {
            id: row.get(0),
            code: row.get(1),
            name: row.get(2),
            category: row.get(3),
            unit: row.get(4),
            stock: row.get(5),
            buy_price: row.get(6),
            sell_price: row.get(7),
            capital_locked,
            sold_30d: row.get(9),
            revenue_30d: row.get(10),
            profit_30d: row.get(11),
            margin_pct: row.get(12),
            velocity_status,
        });
    }

    Ok(ProductsIntelligenceReport {
        total_capital_locked,
        total_dead_stock_skus,
        fast_moving_skus,
        items,
    })
}

#[tauri::command]
pub async fn get_owner_sales_patterns(url: Option<String>) -> Result<SalesPatternsReport, String> {
    let client = get_pg_client(url).await?;
    let hourly_rows = client.query(
        r#"
        SELECT
          EXTRACT(HOUR FROM COALESCE(created_at, NOW()) AT TIME ZONE 'Asia/Jakarta')::int4,
          COUNT(*)::int4,
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8,
          COALESCE(AVG(COALESCE(final_total, total_sell)), 0)::float8
        FROM transactions
        WHERE date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM COALESCE(created_at, NOW()) AT TIME ZONE 'Asia/Jakarta')
        ORDER BY 1 ASC
        "#,
        &[],
    ).await.map_err(|e| format!("Query jam sibuk gagal: {}", e))?;

    let dow_rows = client.query(
        r#"
        SELECT
          TO_CHAR(date, 'Dy'),
          EXTRACT(DOW FROM date)::int4,
          COUNT(*)::int4,
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8
        FROM transactions
        WHERE date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
        GROUP BY TO_CHAR(date, 'Dy'), EXTRACT(DOW FROM date)
        ORDER BY 2 ASC
        "#,
        &[],
    ).await.map_err(|e| format!("Query pola harian gagal: {}", e))?;

    let summary_row = client.query_one(
        r#"
        SELECT
          COUNT(*)::int8,
          COALESCE(SUM(COALESCE(final_total, total_sell)), 0)::float8,
          COALESCE(AVG(COALESCE(final_total, total_sell)), 0)::float8
        FROM transactions
        WHERE date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '30 days'
        "#,
        &[],
    ).await.map_err(|e| format!("Query ringkasan pola penjualan gagal: {}", e))?;

    Ok(SalesPatternsReport {
        total_transactions: summary_row.get(0),
        total_sales: summary_row.get(1),
        average_ticket: summary_row.get(2),
        hourly: hourly_rows.into_iter().map(|r| HourlyPattern {
            hour: r.get(0),
            tx_count: r.get(1),
            revenue: r.get(2),
            aov: r.get(3),
        }).collect(),
        days: dow_rows.into_iter().map(|r| DayPattern {
            day_name: r.get(0),
            dow: r.get(1),
            tx_count: r.get(2),
            revenue: r.get(3),
        }).collect(),
    })
}

#[tauri::command]
pub async fn get_owner_receivables_aging(url: Option<String>) -> Result<ReceivablesAgingReport, String> {
    let client = get_pg_client(url).await?;
    let rows = client.query(
        r#"
        SELECT
          id,
          COALESCE(invoice_no, id),
          COALESCE(buyer, 'Umum'),
          COALESCE(to_char(date, 'YYYY-MM-DD'), ''),
          COALESCE(final_total, total_sell)::float8,
          GREATEST(0, ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date))::int4,
          CASE
            WHEN ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date) <= 7 THEN '0_7_DAYS'
            WHEN ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date) <= 14 THEN '8_14_DAYS'
            WHEN ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - date) <= 30 THEN '15_30_DAYS'
            ELSE 'OVER_30_DAYS'
          END
        FROM transactions
        WHERE UPPER(COALESCE(payment_status, 'LUNAS')) IN ('TEMPO', 'BELUM LUNAS', 'UNPAID')
        ORDER BY date ASC
        LIMIT 1000
        "#,
        &[],
    ).await.map_err(|e| format!("Query aging piutang gagal: {}", e))?;

    let mut bucket_0_7 = 0.0_f64;
    let mut bucket_8_14 = 0.0_f64;
    let mut bucket_15_30 = 0.0_f64;
    let mut bucket_over_30 = 0.0_f64;
    let mut total_pending = 0.0_f64;
    let total_invoices = rows.len() as i64;
    let mut items = Vec::with_capacity(rows.len());

    for row in rows {
        let amount: f64 = row.get(4);
        let aging_bucket: String = row.get(6);
        total_pending += amount;
        match aging_bucket.as_str() {
            "0_7_DAYS" => bucket_0_7 += amount,
            "8_14_DAYS" => bucket_8_14 += amount,
            "15_30_DAYS" => bucket_15_30 += amount,
            _ => bucket_over_30 += amount,
        }
        items.push(ReceivableAgingItem {
            id: row.get(0),
            invoice_no: row.get(1),
            buyer: row.get(2),
            date: row.get(3),
            amount,
            age_days: row.get(5),
            aging_bucket,
        });
    }

    Ok(ReceivablesAgingReport {
        total_pending,
        total_invoices,
        bucket_0_7,
        bucket_8_14,
        bucket_15_30,
        bucket_over_30,
        items,
    })
}

#[tauri::command]
pub async fn get_owner_shifts(url: Option<String>) -> Result<Vec<CashierShift>, String> {
    let client = get_pg_client(url).await?;
    let rows = client.query(
        r#"
        SELECT
          id,
          cashier_name,
          to_char(start_time AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
          to_char(end_time AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
          COALESCE(starting_cash, 0)::float8,
          COALESCE(cash_sales, 0)::float8,
          COALESCE(non_cash_sales, 0)::float8,
          COALESCE(cash_outflow, 0)::float8,
          COALESCE(cash_inflow, 0)::float8,
          COALESCE(refund_outflow, 0)::float8,
          COALESCE(transferred_to_treasury, 0)::float8,
          COALESCE(retained_in_drawer, 0)::float8,
          COALESCE(expected_cash, 0)::float8,
          COALESCE(actual_cash, 0)::float8,
          COALESCE(discrepancy, 0)::float8,
          notes,
          COALESCE(status, 'OPEN')
        FROM cashier_shifts
        ORDER BY start_time DESC
        LIMIT 50
        "#,
        &[],
    ).await.map_err(|e| format!("Query rekap shift gagal: {}", e))?;

    Ok(rows.into_iter().map(|r| CashierShift {
        id: r.get(0),
        cashier_name: r.get(1),
        start_time: r.get(2),
        end_time: r.get(3),
        starting_cash: r.get(4),
        cash_sales: r.get(5),
        non_cash_sales: r.get(6),
        cash_outflow: r.get(7),
        cash_inflow: r.get(8),
        refund_outflow: r.get(9),
        transferred_to_treasury: r.get(10),
        retained_in_drawer: r.get(11),
        expected_cash: r.get(12),
        actual_cash: r.get(13),
        discrepancy: r.get(14),
        notes: r.get(15),
        status: r.get(16),
    }).collect())
}

#[tauri::command]
pub async fn get_owner_settings(url: Option<String>) -> Result<std::collections::HashMap<String, String>, String> {
    let client = get_pg_client(url).await?;
    let rows = client.query(
        "SELECT key, value FROM store_settings WHERE key != 'store_logo'",
        &[],
    ).await.map_err(|e| format!("Query settings gagal: {}", e))?;

    let mut map = std::collections::HashMap::new();
    for row in rows {
        let k: String = row.get(0);
        let v: Option<String> = row.get(1);
        if let Some(val) = v {
            map.insert(k, val);
        }
    }
    Ok(map)
}
