<script setup lang="ts">
import { computed } from 'vue';
import { usePosStore } from '../stores/posStore';
import { useLedgerStore } from '../stores/ledgerStore';
import { ShoppingCart, CalendarDays, BookOpen, Settings, Clock, AlertCircle } from 'lucide-vue-next';

const props = defineProps<{
  activeTab: 'pos' | 'preorder' | 'ledger' | 'master';
}>();

const emit = defineEmits<{
  (e: 'change-tab', tab: 'pos' | 'preorder' | 'ledger' | 'master'): void;
}>();

const posStore = usePosStore();
const ledgerStore = useLedgerStore();

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
};

const cartCount = computed(() => posStore.cartItems.length);
</script>

<template>
  <header class="layout-header">
    <div class="header-brand">
      <div class="brand-logo">KC</div>
      <div class="brand-text">
        <h1 class="brand-title">KASIR CITRA <span class="badge-sppg">SISTEM KASIR</span></h1>
        <p class="brand-subtitle">Sistem Kasir, Distribusi Grosir & Penjualan Ritel</p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'pos' }"
        @click="emit('change-tab', 'pos')"
        title="Layar Kasir & Input Nota Kedatangan"
      >
        <ShoppingCart :size="16" />
        <span>Kasir POS</span>
        <span v-if="cartCount > 0" class="tab-badge">{{ cartCount }}</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'preorder' }"
        @click="emit('change-tab', 'preorder')"
        title="Matriks Rekap Pesanan Supplier Mingguan"
      >
        <CalendarDays :size="16" />
        <span>Rekap Pre-Order</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'ledger' }"
        @click="emit('change-tab', 'ledger')"
        title="Buku Besar & Monitoring Piutang Tempo"
      >
        <BookOpen :size="16" />
        <span>Buku Besar & Piutang</span>
        <span v-if="ledgerStore.totalReceivables > 0" class="tab-badge warning">Tempo</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'master' }"
        @click="emit('change-tab', 'master')"
        title="Master SKU & Konfigurasi Markup Supplier"
      >
        <Settings :size="16" />
        <span>Master & Markup</span>
      </button>
    </nav>

    <!-- Quick Stats & Context -->
    <div class="header-metrics">
      <div v-if="ledgerStore.totalReceivables > 0" class="metric-pill warning" title="Total Piutang Belum Lunas">
        <AlertCircle :size="14" />
        <span>Piutang: <strong>{{ formatRupiah(ledgerStore.totalReceivables) }}</strong></span>
      </div>

      <div class="metric-pill info" title="Pembeli Aktif di Kasir">
        <Clock :size="14" />
        <span>{{ posStore.selectedBuyer }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.layout-header {
  height: 56px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
  z-index: 50;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.95rem;
  color: #fff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

.brand-title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-kasir {
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  letter-spacing: 0.05em;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.brand-subtitle {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.nav-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-app);
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-muted);
  position: relative;
}

.tab-btn:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.04);
}

.tab-btn.active {
  background: var(--bg-surface-elevated);
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-badge {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--primary);
  color: white;
  font-weight: 700;
}

.tab-badge.warning {
  background: var(--warning);
  color: #111;
}

.header-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
}

.metric-pill.warning {
  background: var(--warning-bg);
  color: #fbbf24;
  border-color: var(--warning-border);
}

.metric-pill.info {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.25);
}

@media (max-width: 900px) {
  .brand-subtitle { display: none; }
  .tab-btn span { display: none; }
  .tab-btn { padding: 6px 10px; }
}
</style>
