# Persistence regression tests

Frontend: `bun test tests/persistence.test.ts`.

Backend: create a **fresh disposable PostgreSQL database** whose name starts with
`kasir_citra_test_`, set `DATABASE_URL` to its connection string, then run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml --test persistence -- --ignored
```

Drop that disposable database after the run. The test rejects other database names
and creates its own schema and fixtures. It exercises real Rust commands: atomic
checkout and rollback, retry idempotency, insufficient points/stock, persistent
deletes, preorder date changes, and receiving create/edit/delete/import.

`db/purchases.sql` is applied automatically when the receiving commands first run.
Existing local receiving history is imported once per installation without applying
stock again; the current PostgreSQL stock is retained as the migration baseline.
Legacy receipts that were never successfully synced to inventory need reconciliation.

Deleting a sales ledger record reverses the transaction: stock and loyalty points are
restored automatically, and coupon usage counts are decremented. The confirmation
dialog states this behavior.
