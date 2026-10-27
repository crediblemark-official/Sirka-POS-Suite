use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BuyerRecord {
    pub id: String,
    pub name: String,
    pub code: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    #[serde(rename = "customerType")]
    pub customer_type: Option<String>,
    #[serde(rename = "memberCardNo")]
    pub member_card_no: Option<String>,
    pub tier: Option<String>,
    pub points: Option<f64>,
    #[serde(rename = "totalSpend")]
    pub total_spend: Option<f64>,
    #[serde(rename = "memberSince")]
    pub member_since: Option<String>,
    /// Catatan pelanggan (juga dipakai untuk jejak audit penyesuaian poin).
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StoreSettingRecord {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductUnitConversionRecord {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(rename = "unitName")]
    pub unit_name: String,
    #[serde(rename = "conversionFactor")]
    pub conversion_factor: f64,
    #[serde(default, rename = "sellPrice")]
    pub sell_price: Option<f64>,
    #[serde(default)]
    pub barcode: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductRecord {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category: String,
    pub unit: String,
    #[serde(rename = "defaultMarkupPercent")]
    pub default_markup_percent: f64,
    #[serde(rename = "lastBuyPrice")]
    pub last_buy_price: f64,
    #[serde(rename = "lastSellPrice")]
    pub last_sell_price: f64,
    #[serde(default)]
    pub supplier: Option<String>,
    #[serde(default)]
    pub barcode: Option<String>,
    pub stock: f64,
    pub notes: Option<String>,
    /// BUG FIX: satuan tambahan (multi-unit / konversi kemasan) sebelumnya dibuang
    /// oleh serde sehingga fitur jual per DUS/SAK/PETI hilang setiap reload.
    #[serde(default)]
    pub units: Option<Vec<ProductUnitConversionRecord>>,
    /// Penanda barang mudah busuk (prioritas FEFO).
    #[serde(default, rename = "isPerishable")]
    pub is_perishable: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CategoryMarkupRecord {
    pub category: String,
    #[serde(rename = "defaultMarkupPercent")]
    pub default_markup_percent: f64,
    pub description: Option<String>,
    /// BUG FIX: warna kategori sebelumnya tidak pernah tersimpan sehingga fitur
    /// kisi produk berwarna kategori (commit terakhir) selalu kembali ke acak.
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PreOrderRecord {
    pub id: String,
    pub date: String,
    #[serde(rename = "dayName")]
    pub day_name: String,
    pub buyer: String,
    pub items: serde_json::Value,
    #[serde(default, rename = "isLoadedToPos")]
    pub is_loaded_to_pos: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct TransactionRecord {
    pub id: String,
    #[serde(rename = "invoiceNo")]
    pub invoice_no: String,
    pub date: String,
    pub buyer: String,
    pub items: serde_json::Value,
    #[serde(rename = "totalBuy")]
    pub total_buy: f64,
    #[serde(rename = "totalSell")]
    pub total_sell: f64,
    #[serde(rename = "totalProfit")]
    pub total_profit: f64,
    #[serde(rename = "profitPercent")]
    pub profit_percent: f64,
    #[serde(rename = "paymentStatus")]
    pub payment_status: String,
    #[serde(rename = "paymentMethod")]
    pub payment_method: String,
    #[serde(rename = "customerType")]
    pub customer_type: Option<String>,
    pub notes: Option<String>,
    #[serde(rename = "discountAmount")]
    pub discount_amount: Option<f64>,
    #[serde(rename = "discountCode")]
    pub discount_code: Option<String>,
    #[serde(rename = "pointsUsed")]
    pub points_used: Option<f64>,
    #[serde(rename = "pointsDiscount")]
    pub points_discount: Option<f64>,
    #[serde(rename = "pointsEarned")]
    pub points_earned: Option<f64>,
    #[serde(rename = "finalTotal")]
    pub final_total: Option<f64>,
    #[serde(default, rename = "isPreOrder")]
    pub is_pre_order: Option<bool>,
    #[serde(default, rename = "picName")]
    pub pic_name: Option<String>,
    // BUG FIX: 9 field berikut sebelumnya tidak ada di struct ini sehingga
    // serde DIBUANG diam-diam (serde mengabaikan field tak dikenal). Akibatnya
    // split payment, kembalian, infaq, shiftId, dan status refund hilang dari
    // SQLite, PostgreSQL, dan hasil pull — sehingga struk tidak bisa direkonstruksi
    // dari database dan rekonsiliasi shift mustahil dilakukan dari sisi cloud.
    #[serde(default, rename = "isSplitPayment")]
    pub is_split_payment: Option<bool>,
    #[serde(default, rename = "cashAmount")]
    pub cash_amount: Option<f64>,
    #[serde(default, rename = "nonCashAmount")]
    pub non_cash_amount: Option<f64>,
    #[serde(default, rename = "nonCashMethod")]
    pub non_cash_method: Option<String>,
    #[serde(default, rename = "changeAmount")]
    pub change_amount: Option<f64>,
    #[serde(default, rename = "infaqAmount")]
    pub infaq_amount: Option<f64>,
    #[serde(default, rename = "shiftId")]
    pub shift_id: Option<String>,
    #[serde(default, rename = "refundStatus")]
    pub refund_status: Option<String>,
    #[serde(default, rename = "refundTotal")]
    pub refund_total: Option<f64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiscountRecord {
    pub id: String,
    pub code: String,
    pub name: String,
    pub r#type: String,
    pub value: f64,
    #[serde(rename = "minPurchase")]
    pub min_purchase: f64,
    #[serde(rename = "maxDiscount")]
    pub max_discount: Option<f64>,
    pub scope: String,
    #[serde(rename = "targetCategory")]
    pub target_category: Option<String>,
    #[serde(rename = "targetCustomerType")]
    pub target_customer_type: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    pub description: Option<String>,
    #[serde(rename = "usageCount")]
    pub usage_count: Option<i32>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}
