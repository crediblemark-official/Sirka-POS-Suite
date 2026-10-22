<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next';
import { formatRupiah } from '../../../utils/formatters';

defineProps<{
  totalDeadStockCapital: number;
  deadStockCount: number;
  marginPercent: number;
  avgTicketSize: number;
  bucketOver30: number;
  netWorthEquity: number;
  purchaseCount: number;
  shiftCount: number;
}>();

const emit = defineEmits<{
  (e: 'navigate-tab', tab: 'shifts'): void;
  (e: 'export-report'): void;
}>();
</script>

<template>
  <div class="flex-1 overflow-auto p-4 space-y-4">
    <!-- Dead Stock Alert Bar -->
    <div class="p-3 bg-amber-50 border border-amber-300 rounded flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <AlertTriangle :size="18" class="text-amber-800 shrink-0" />
        <div>
          <div class="text-xs font-bold text-amber-900">
            Modal Terkunci di Barang Mati (Dead Stock): Rp {{ formatRupiah(totalDeadStockCapital) }}
          </div>
          <div class="text-[11px] text-amber-800">
            Terdapat {{ deadStockCount }} SKU dengan stok fisik di rak yang belum bergerak sama sekali.
          </div>
        </div>
      </div>
      <button
        type="button"
        @click="emit('export-report')"
        class="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold shadow-2xs cursor-pointer"
      >
        Cetak Rekomendasi Diskon
      </button>
    </div>

    <!-- 9 Modules Table -->
    <table class="table-explorer w-full">
      <thead>
        <tr>
          <th class="w-12 text-center">NO</th>
          <th class="w-64 text-left">MODUL ANALISIS BISNIS</th>
          <th class="w-48 text-left">FUNGSI STRATEGIS</th>
          <th class="w-48 text-right">METRIK / INDIKATOR</th>
          <th class="text-left">TINDAKAN MANAJERIAL OWNER</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center font-mono font-bold">01</td>
          <td class="font-bold text-amber-800">Dead Stock &amp; Capital Locked Tracker</td>
          <td>Deteksi modal yang membeku di rak</td>
          <td class="text-right font-mono font-bold text-amber-700">Rp {{ formatRupiah(totalDeadStockCapital) }}</td>
          <td class="text-gray-600">Lakukan promo cuci gudang (*clearance*) atau bundling</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">02</td>
          <td class="font-bold text-blue-800">Analisis ABC Pareto (Prinsip 80/20)</td>
          <td>Fokus 20% SKU penggerak 80% omzet</td>
          <td class="text-right font-mono font-bold text-blue-700">Kelas A: Top 20%</td>
          <td class="text-gray-600">Prioritaskan restock agar produk terlaris tidak pernah habis</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">03</td>
          <td class="font-bold text-emerald-800">Matriks Kuadran Margin vs Volume</td>
          <td>Kategori Star, Cash Cow &amp; Dead Weight</td>
          <td class="text-right font-mono font-bold text-emerald-700">Margin: {{ marginPercent.toFixed(1) }}%</td>
          <td class="text-gray-600">Pertahankan stok Star &amp; Cash Cow, evaluasi Dead Weight</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">04</td>
          <td class="font-bold text-purple-800">Heatmap Jam &amp; Hari Sibuk (Peak Hours)</td>
          <td>Pemetaan rush hour 08:00 - 21:00</td>
          <td class="text-right font-mono font-bold text-purple-700">Jam 11:00 - 14:00</td>
          <td class="text-gray-600">Atur shift kasir agar tidak overstaffing di jam sepi</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">05</td>
          <td class="font-bold text-indigo-800">Nilai Keranjang Belanja &amp; AOV</td>
          <td>Average Order Value per struk nota</td>
          <td class="text-right font-mono font-bold text-indigo-700">Rp {{ formatRupiah(avgTicketSize) }}</td>
          <td class="text-gray-600">Latih kasir menawarkan barang impulsif tambahan di kasir</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">06</td>
          <td class="font-bold text-red-800">Aging Schedule Piutang Bertingkat</td>
          <td>Segmentasi umur tagihan bon tempo</td>
          <td class="text-right font-mono font-bold text-red-700">Macet: Rp {{ formatRupiah(bucketOver30) }}</td>
          <td class="text-gray-600">Kunci nota baru untuk pelanggan dengan tagihan macet &gt;30 HARI</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">07</td>
          <td class="font-bold text-teal-800">Neraca Posisi Keuangan (Balance Sheet)</td>
          <td>Total Aset dikurangi Hutang Supplier</td>
          <td class="text-right font-mono font-bold text-teal-700">Net: Rp {{ formatRupiah(netWorthEquity) }}</td>
          <td class="text-gray-600">Evaluasi pertumbuhan kekayaan bersih toko dari bulan ke bulan</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">08</td>
          <td class="font-bold text-orange-800">Buku Hutang Dagang Supplier (AP Aging)</td>
          <td>Kalender jatuh tempo pembayaran faktur</td>
          <td class="text-right font-mono font-bold text-orange-700">{{ purchaseCount }} Faktur</td>
          <td class="text-gray-600">Siapkan dana kas sebelum tempo distributor jatuh tempo</td>
        </tr>
        <tr class="hover:bg-blue-50/40 cursor-pointer transition-colors" @click="emit('navigate-tab', 'shifts')">
          <td class="text-center font-mono font-bold text-blue-700">09</td>
          <td class="font-bold text-red-800 flex items-center justify-between">
            <span>Audit Kasir &amp; Selisih Shift (Anti-Fraud)</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Buka Modul ↗
            </span>
          </td>
          <td>Rekonsiliasi fisik vs sistem kasir</td>
          <td class="text-right font-mono font-bold text-gray-700">
            {{ shiftCount }} Shift Tercatat
          </td>
          <td class="text-gray-600">Cek rekap selisih kas fisik laci kasir dan catatan serah terima shift</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
