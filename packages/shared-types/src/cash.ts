// Cash Mutation & Outflow Management (Uang Keluar & Pemindahan Kas)
export type CashAccountType = 'TUNAI' | 'BANK' | 'QRIS';
export type CashMutationType = 'EXPENSE' | 'TRANSFER' | 'INFLOW';

export interface CashMutation {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  type: CashMutationType;
  fromAccount: CashAccountType;
  toAccount?: CashAccountType; // Hanya jika type === 'TRANSFER'
  amount: number;
  category: string; // e.g. 'Operasional', 'Plastik & Kemasan', 'Listrik & Air', 'Gaji / Upah', 'Prive', 'Settlement QRIS', 'Setor Bank'
  notes: string;
  referenceNo?: string;
  settled?: boolean; // True jika mutasi/pencairan sudah selesai
  createdAt: string;
}

export interface CashAccountBalances {
  // Tunai
  salesCash: number;
  expenseCash: number;
  transferOutCash: number;
  transferInCash: number;
  netCashDrawer: number;

  // Bank
  salesBank: number;
  expenseBank: number;
  transferOutBank: number;
  transferInBank: number;
  purchasesCostBank: number;
  netBankBalance: number;

  // QRIS
  salesQris: number;
  settledQrisToBank: number;
  expenseQris: number;
  pendingQrisSettlement: number;

  // Total
  totalLiquidFunds: number;
}
