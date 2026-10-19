use serde_json::json;
use tauri_app_lib::{
    commands::*,
    db::get_pg_client,
    models::{PreOrderRecord, TransactionRecord},
};

// Run against a fresh disposable database; never against operational data.
#[tokio::test]
#[ignore = "requires DATABASE_URL pointing to a fresh kasir_citra_test_* database"]
async fn persistence_workflows() {
    let client = get_pg_client().await.unwrap();
    let db: String = client
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    assert!(
        db.starts_with("kasir_citra_test_"),
        "Use a disposable test database"
    );
    client
        .batch_execute(include_str!("../../db/schema.sql"))
        .await
        .unwrap();
    client.batch_execute("INSERT INTO category_markups(category) VALUES ('test');
      INSERT INTO products(id,code,name,category,unit,stock) VALUES ('p','p','Product','test','PCS',10);
      INSERT INTO buyers(id,name,member_card_no,points,total_spend) VALUES ('b','Buyer','M1',20,0);").await.unwrap();
    let tx: TransactionRecord = serde_json::from_value(json!({
      "id":"t1", "invoiceNo":"INV1", "date":"2026-10-19", "buyer":"Buyer",
      "items":[{"productId":"p","qty":2,"sellPrice":100}],
      "totalBuy":100,"totalSell":200,"totalProfit":50,"profitPercent":50,
      "paymentStatus":"TEMPO","paymentMethod":"Nota Tempo",
      "pointsUsed":5,"pointsEarned":1,"pointsDiscount":50,"finalTotal":150
    }))
    .unwrap();
    db_create_transaction(tx.clone(), Some("b".into()))
        .await
        .unwrap();
    db_create_transaction(tx.clone(), Some("b".into()))
        .await
        .unwrap();
    let stock: f64 = client
        .query_one("SELECT stock::float8 FROM products WHERE id='p'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(stock, 8.0, "qty consumed once, including retry");
    let row = client
        .query_one(
            "SELECT points::float8,total_spend::float8 FROM buyers WHERE id='b'",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, f64>(0), 16.0);
    assert_eq!(row.get::<_, f64>(1), 150.0);
    let mut failed = tx.clone();
    failed.id = "failed".into();
    failed.invoice_no = "FAILED".into();
    failed.items = json!([{"productId":"p","qty":1,"sellPrice":100},{"productId":"missing","qty":1,"sellPrice":100}]);
    assert!(
        db_create_transaction(failed, Some("b".into()))
            .await
            .is_err()
    );
    let stock: f64 = client
        .query_one("SELECT stock::float8 FROM products WHERE id='p'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(stock, 8.0, "partial stock changes rolled back");
    let points: f64 = client
        .query_one("SELECT points::float8 FROM buyers WHERE id='b'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(points, 16.0, "points rolled back");
    assert_eq!(db_get_transactions().await.unwrap().len(), 1);
    let mut insufficient = tx.clone();
    insufficient.id = "insufficient".into();
    insufficient.invoice_no = "INSUFFICIENT".into();
    insufficient.points_used = Some(999.0);
    assert!(
        db_create_transaction(insufficient, Some("b".into()))
            .await
            .is_err()
    );
    let mut oversell = tx.clone();
    oversell.id = "oversell".into();
    oversell.invoice_no = "OVERSELL".into();
    oversell.items = json!([{"productId":"p","qty":100,"sellPrice":100}]);
    assert!(
        db_create_transaction(oversell, Some("b".into()))
            .await
            .is_err()
    );
    assert_eq!(db_get_transactions().await.unwrap().len(), 1);
    db_delete_transaction("t1".into()).await.unwrap();
    assert!(db_get_transactions().await.unwrap().is_empty());

    let mut po: PreOrderRecord = serde_json::from_value(
        json!({"id":"po","date":"2026-10-19","dayName":"Senin","buyer":"Buyer","items":[]}),
    )
    .unwrap();
    db_save_preorder(po.clone()).await.unwrap();
    po.date = "2026-10-20".into();
    po.day_name = "Selasa".into();
    db_save_preorder(po).await.unwrap();
    let loaded = db_get_preorders().await.unwrap();
    assert_eq!(loaded[0].date, "2026-10-20");
    assert_eq!(loaded[0].day_name, "Selasa");
    db_delete_preorder("po".into()).await.unwrap();
    assert!(db_get_preorders().await.unwrap().is_empty());

    let mut receipt = json!({"id":"r","createdAt":"2026-10-19","items":[{"productId":"p","qtyReceived":3,"buyPrice":50,"newSellPrice":100}]});
    db_save_purchase(receipt.clone()).await.unwrap();
    db_save_purchase(receipt.clone()).await.unwrap();
    let stock: f64 = client
        .query_one("SELECT stock::float8 FROM products WHERE id='p'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(stock, 11.0, "save retry must not double receive");
    receipt["items"][0]["qtyReceived"] = json!(5);
    db_save_purchase(receipt.clone()).await.unwrap();
    let stock: f64 = client
        .query_one("SELECT stock::float8 FROM products WHERE id='p'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(stock, 13.0);
    assert_eq!(db_get_purchases().await.unwrap()[0], receipt);
    let mut invalid = receipt.clone();
    invalid["items"]
        .as_array_mut()
        .unwrap()
        .push(json!({"productId":"missing","qtyReceived":1,"buyPrice":1,"newSellPrice":2}));
    assert!(db_save_purchase(invalid).await.is_err());
    assert_eq!(
        db_get_purchases().await.unwrap()[0],
        receipt,
        "failed edit retains original receipt"
    );
    client
        .execute("UPDATE products SET stock = 1 WHERE id = 'p'", &[])
        .await
        .unwrap();
    assert!(
        db_delete_purchase("r".into()).await.is_err(),
        "cannot reverse already consumed stock"
    );
    assert_eq!(db_get_purchases().await.unwrap().len(), 1);
    client
        .execute("UPDATE products SET stock = 13 WHERE id = 'p'", &[])
        .await
        .unwrap();
    db_delete_purchase("r".into()).await.unwrap();
    let stock: f64 = client
        .query_one("SELECT stock::float8 FROM products WHERE id='p'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(stock, 8.0);
    assert!(db_get_purchases().await.unwrap().is_empty());
    db_import_purchases(vec![receipt.clone()]).await.unwrap();
    db_import_purchases(vec![receipt]).await.unwrap();
    assert_eq!(db_get_purchases().await.unwrap().len(), 1);
    let stock: f64 = client
        .query_one("SELECT stock::float8 FROM products WHERE id='p'", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(stock, 8.0, "legacy import must not change stock");
}
