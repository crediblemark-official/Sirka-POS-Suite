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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StoreSettingRecord {
    pub key: String,
    pub value: String,
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CategoryMarkupRecord {
    pub category: String,
    #[serde(rename = "defaultMarkupPercent")]
    pub default_markup_percent: f64,
    pub description: Option<String>,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
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
