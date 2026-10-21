import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CashierShift } from '../types';

const STORAGE_KEY_CURRENT_SHIFT = 'kasir_citra_current_shift_v1';
const STORAGE_KEY_SHIFT_HISTORY = 'kasir_citra_shift_history_v1';
const API_BASE_URL = 'https://sirka-owner-api.irudsa.workers.dev';

export const useShiftStore = defineStore('shift', () => {
  const currentShift = ref<CashierShift | null>(null);
  const shiftHistory = ref<CashierShift[]>([]);
  const isLoading = ref(false);

  // Modal Control States
  const showOpenShiftModal = ref(false);
  const showCloseShiftModal = ref(false);
  const showShiftSummaryModal = ref(false);
  const lastClosedShift = ref<CashierShift | null>(null);

  const isShiftActive = computed(() => {
    return currentShift.value !== null && currentShift.value.status === 'OPEN';
  });

  // Calculate shift duration display
  const shiftDuration = computed(() => {
    if (!currentShift.value?.startTime) return '-';
    const start = new Date(currentShift.value.startTime).getTime();
    const end = currentShift.value.endTime
      ? new Date(currentShift.value.endTime).getTime()
      : Date.now();
    const diffMin = Math.floor((end - start) / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}j ${mins}m`;
  });

  function loadLocal() {
    try {
      const savedCurrent = localStorage.getItem(STORAGE_KEY_CURRENT_SHIFT);
      if (savedCurrent) {
        currentShift.value = JSON.parse(savedCurrent);
      }
      const savedHistory = localStorage.getItem(STORAGE_KEY_SHIFT_HISTORY);
      if (savedHistory) {
        shiftHistory.value = JSON.parse(savedHistory);
      }
    } catch (e) {
      console.warn('Failed to parse local shifts:', e);
    }
  }

  function saveLocal() {
    try {
      if (currentShift.value) {
        localStorage.setItem(STORAGE_KEY_CURRENT_SHIFT, JSON.stringify(currentShift.value));
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_SHIFT);
      }
      localStorage.setItem(STORAGE_KEY_SHIFT_HISTORY, JSON.stringify(shiftHistory.value));
    } catch (e) {
      console.error('Failed to save shifts to localStorage:', e);
    }
  }

  // Sync a single shift to Cloudflare Worker & PostgreSQL
  async function syncShiftToCloud(shift: CashierShift) {
    try {
      await fetch(`${API_BASE_URL}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shift)
      });
    } catch (err) {
      console.warn('[ShiftStore] Offline or sync failure for shift:', err);
    }
  }

  // Fetch all shift histories from PostgreSQL
  async function fetchShiftsFromApi() {
    isLoading.value = true;
    try {
      const res = await fetch(`${API_BASE_URL}/api/shifts`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Find any OPEN shift from cloud if local doesn't have one
          const openOne = data.find((s: any) => s.status === 'OPEN');
          if (openOne && !currentShift.value) {
            currentShift.value = {
              id: openOne.id,
              cashierName: openOne.cashier_name || openOne.cashierName,
              startTime: openOne.start_time || openOne.startTime,
              startingCash: Number(openOne.starting_cash || openOne.startingCash || 0),
              cashSales: Number(openOne.cash_sales || openOne.cashSales || 0),
              nonCashSales: Number(openOne.non_cash_sales || openOne.nonCashSales || 0),
              cashOutflow: Number(openOne.cash_outflow || openOne.cashOutflow || 0),
              expectedCash: Number(openOne.expected_cash || openOne.expectedCash || 0),
              notes: openOne.notes || '',
              status: 'OPEN'
            };
          }

          // Populate shift history
          shiftHistory.value = data.map((s: any) => ({
            id: s.id,
            cashierName: s.cashier_name || s.cashierName,
            startTime: s.start_time || s.startTime,
            endTime: s.end_time || s.endTime,
            startingCash: Number(s.starting_cash || s.startingCash || 0),
            cashSales: Number(s.cash_sales || s.cashSales || 0),
            nonCashSales: Number(s.non_cash_sales || s.nonCashSales || 0),
            cashOutflow: Number(s.cash_outflow || s.cashOutflow || 0),
            expectedCash: Number(s.expected_cash || s.expectedCash || 0),
            actualCash: s.actual_cash !== null && s.actual_cash !== undefined ? Number(s.actual_cash) : undefined,
            discrepancy: s.discrepancy !== null && s.discrepancy !== undefined ? Number(s.discrepancy) : undefined,
            notes: s.notes || '',
            status: s.status,
            createdAt: s.created_at || s.createdAt
          }));
          saveLocal();
        }
      }
    } catch (e) {
      console.warn('[ShiftStore] Cannot connect to shifts API, using offline cache:', e);
    } finally {
      isLoading.value = false;
    }
  }

  // Open Shift
  async function openShift(cashierName: string, startingCash: number, notes?: string): Promise<CashierShift> {
    const shift: CashierShift = {
      id: `shift-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      cashierName: cashierName.trim() || 'Kasir Toko',
      startTime: new Date().toISOString(),
      startingCash: Math.max(0, startingCash),
      cashSales: 0,
      nonCashSales: 0,
      cashOutflow: 0,
      expectedCash: Math.max(0, startingCash),
      notes: notes?.trim() || '',
      status: 'OPEN'
    };

    currentShift.value = shift;
    saveLocal();
    showOpenShiftModal.value = false;

    // Background sync to Cloudflare
    syncShiftToCloud(shift);

    return shift;
  }

  // Record completed sale in active shift
  function recordSale(cashAmount: number, nonCashAmount: number) {
    if (!currentShift.value || currentShift.value.status !== 'OPEN') return;

    if (cashAmount > 0) {
      currentShift.value.cashSales += cashAmount;
    }
    if (nonCashAmount > 0) {
      currentShift.value.nonCashSales += nonCashAmount;
    }

    currentShift.value.expectedCash =
      currentShift.value.startingCash + currentShift.value.cashSales - currentShift.value.cashOutflow;

    saveLocal();
    syncShiftToCloud(currentShift.value);
  }

  // Record cash inflow (Poin 9: tip, infaq, donasi, titipan pelanggan)
  function recordCashInflow(amount: number, reason: string, source: 'INFAQ' | 'TIP' | 'TITIPAN' | 'LAINNYA' = 'INFAQ') {
    if (!currentShift.value || currentShift.value.status !== 'OPEN') return;
    if (amount <= 0) return;

    currentShift.value.cashInflow = (currentShift.value.cashInflow || 0) + amount;
    recalculateExpectedCash();

    const inflowNote = `[Pemasukan Non-Jual (${source}): Rp ${amount.toLocaleString('id-ID')} - ${reason}]`;
    currentShift.value.notes = currentShift.value.notes
      ? `${currentShift.value.notes} | ${inflowNote}`
      : inflowNote;

    saveLocal();
    syncShiftToCloud(currentShift.value);
  }

  // Record cash outflow from register (operational expense)
  function recordCashOutflow(amount: number, reason: string) {
    if (!currentShift.value || currentShift.value.status !== 'OPEN') return;
    if (amount <= 0) return;

    currentShift.value.cashOutflow += amount;
    recalculateExpectedCash();

    if (reason) {
      const outflowNote = `[Pengeluaran Kas: Rp ${amount.toLocaleString('id-ID')} - ${reason}]`;
      currentShift.value.notes = currentShift.value.notes
        ? `${currentShift.value.notes} | ${outflowNote}`
        : outflowNote;
    }

    saveLocal();
    syncShiftToCloud(currentShift.value);
  }

  // Record cash refund outflow (Poin 6: retur uang kasir)
  function recordRefundOutflow(amount: number, invoiceNo: string) {
    if (!currentShift.value || currentShift.value.status !== 'OPEN') return;
    if (amount <= 0) return;

    currentShift.value.refundOutflow = (currentShift.value.refundOutflow || 0) + amount;
    recalculateExpectedCash();

    const refundNote = `[Retur Tunai Nota ${invoiceNo}: Rp ${amount.toLocaleString('id-ID')}]`;
    currentShift.value.notes = currentShift.value.notes
      ? `${currentShift.value.notes} | ${refundNote}`
      : refundNote;

    saveLocal();
    syncShiftToCloud(currentShift.value);
  }

  function recalculateExpectedCash() {
    if (!currentShift.value) return;
    const start = currentShift.value.startingCash || 0;
    const sales = currentShift.value.cashSales || 0;
    const inflow = currentShift.value.cashInflow || 0;
    const outflow = currentShift.value.cashOutflow || 0;
    const refund = currentShift.value.refundOutflow || 0;
    currentShift.value.expectedCash = start + sales + inflow - outflow - refund;
  }

  // Close Shift & Cash Reconciliation (Poin 10: Setoran bendahara & modal laci)
  async function closeShift(
    actualCash: number,
    closingNotes?: string,
    allocation?: { transferredToTreasury?: number; retainedInDrawer?: number }
  ): Promise<CashierShift> {
    if (!currentShift.value) {
      throw new Error('Tidak ada shift aktif yang dapat ditutup');
    }

    recalculateExpectedCash();
    const expected = currentShift.value.expectedCash;
    const discrepancy = actualCash - expected;
    const endTime = new Date().toISOString();

    const fullNotes = [
      currentShift.value.notes,
      closingNotes?.trim() ? `[Tutup: ${closingNotes.trim()}]` : '',
      allocation?.transferredToTreasury ? `[Setor Bendahara: Rp ${allocation.transferredToTreasury.toLocaleString('id-ID')}]` : '',
      allocation?.retainedInDrawer ? `[Sisa Kasir: Rp ${allocation.retainedInDrawer.toLocaleString('id-ID')}]` : ''
    ].filter(Boolean).join(' | ');

    const closed: CashierShift = {
      ...currentShift.value,
      endTime,
      actualCash,
      discrepancy,
      transferredToTreasury: allocation?.transferredToTreasury ?? actualCash,
      retainedInDrawer: allocation?.retainedInDrawer ?? 0,
      notes: fullNotes,
      status: 'CLOSED'
    };

    // Prepend to history
    shiftHistory.value = [closed, ...shiftHistory.value.filter(s => s.id !== closed.id)];
    lastClosedShift.value = closed;
    currentShift.value = null;

    saveLocal();
    showCloseShiftModal.value = false;
    showShiftSummaryModal.value = true;

    // Background sync to Cloudflare
    syncShiftToCloud(closed);

    return closed;
  }

  // Initial load
  loadLocal();
  fetchShiftsFromApi();

  return {
    currentShift,
    shiftHistory,
    isLoading,
    isShiftActive,
    shiftDuration,
    showOpenShiftModal,
    showCloseShiftModal,
    showShiftSummaryModal,
    lastClosedShift,
    openShift,
    recordSale,
    recordCashInflow,
    recordCashOutflow,
    recordRefundOutflow,
    closeShift,
    fetchShiftsFromApi
  };
});
