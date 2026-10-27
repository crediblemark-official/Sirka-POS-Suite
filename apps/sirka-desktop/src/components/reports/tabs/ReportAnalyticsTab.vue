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
            Modal Uang Macet di Barang Tidak Laku (Stok Mati): Rp {{ formatRupiah(totalDeadStockCapital) }}
          </div>
          <div class="text-[11px] text-amber-800">
            Terdapat {{ deadStockCount }} jenis barang di rak yang belum pernah laku terjual sama sekali.
          </div>
        </div>
      </div>
      <button
        type="button"
        @click="emit('export-report')"
        class="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold shadow-2xs cursor-pointer"
      >
        Cetak Daftar Cuci Gudang
      </button>
    </div>

    <!-- 9 Modules Table -->
    <div class="overflow-x-auto border border-gray-200 rounded">
      <table class="table-explorer w-full min-w-[850px] whitespace-nowrap">
      <thead>
        <tr>
          <th class="w-12 text-center">NO</th>
          <th class="w-64 text-left">ANALISIS KONDISI TOKO</th>
          <th class="w-48 text-left">MANFAAT / KEGUNAAN</th>
          <th class="w-48 text-right">HASIL DATA</th>
          <th class="text-left">SARAN TINDAKAN UNTUK PEMILIK TOKO</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center font-mono font-bold">01</td>
          <td class="font-bold text-amber-800">Barang Tidak Laku (Stok Macet)</td>
          <td>Melihat uang modal yang membeku di rak</td>
          <td class="text-right font-mono font-bold text-amber-700">Rp {{ formatRupiah(totalDeadStockCapital) }}</td>
          <td class="text-gray-600">Lakukan promo cuci gudang (*diskon besar*) atau paket bundling hemat</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">02</td>
          <td class="font-bold text-blue-800">Barang Paling Laris (Prinsip 80/20)</td>
          <td>Fokus 20% barang yang menyumbang 80% omzet</td>
          <td class="text-right font-mono font-bold text-blue-700">Kelas A: Top 20% Terlaris</td>
          <td class="text-gray-600">Prioritaskan kulakan agar barang terlaris ini tidak pernah kehabisan stok</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">03</td>
          <td class="font-bold text-emerald-800">Kombinasi Keuntungan vs Kecepatan Laku</td>
          <td>Membedakan barang cepat laku vs untung besar</td>
          <td class="text-right font-mono font-bold text-emerald-700">Margin: {{ marginPercent.toFixed(1) }}%</td>
          <td class="text-gray-600">Pertahankan stok barang cepat laku, evaluasi barang yang lambat bergerak</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">04</td>
          <td class="font-bold text-purple-800">Jam &amp; Hari Toko Paling Ramai</td>
          <td>Waktu ramai pembeli datang berbelanja</td>
          <td class="text-right font-mono font-bold text-purple-700">Jam 11:00 - 14:00</td>
          <td class="text-gray-600">Siapkan kasir lebih banyak di jam ramai dan kurangi di jam sepi</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">05</td>
          <td class="font-bold text-indigo-800">Rata-rata Belanja per Pembeli (AOV)</td>
          <td>Rata-rata uang belanja pembeli sekali datang</td>
          <td class="text-right font-mono font-bold text-indigo-700">Rp {{ formatRupiah(avgTicketSize) }}</td>
          <td class="text-gray-600">Pajang barang pelengkap di dekat kasir agar pembeli belanja lebih banyak</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">06</td>
          <td class="font-bold text-red-800">Jadwal Pengingat Bon &amp; Tagihan Pelanggan</td>
          <td>Melihat bon pembeli yang sudah lama belum dibayar</td>
          <td class="text-right font-mono font-bold text-red-700">Macet: Rp {{ formatRupiah(bucketOver30) }}</td>
          <td class="text-gray-600">Tahan bon baru untuk pelanggan yang punya tagihan macet &gt;30 hari</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">07</td>
          <td class="font-bold text-teal-800">Total Kekayaan Bersih Toko (Modal Bersih)</td>
          <td>Total semua harta toko dikurangi hutang supplier</td>
          <td class="text-right font-mono font-bold text-teal-700">Net: Rp {{ formatRupiah(netWorthEquity) }}</td>
          <td class="text-gray-600">Pantau pertumbuhan kekayaan bersih toko dari bulan ke bulan</td>
        </tr>
        <tr>
          <td class="text-center font-mono font-bold">08</td>
          <td class="font-bold text-orange-800">Catatan Hutang Kulakan ke Supplier</td>
          <td>Jadwal jatuh tempo pembayaran faktur kulakan</td>
          <td class="text-right font-mono font-bold text-orange-700">{{ purchaseCount }} Faktur</td>
          <td class="text-gray-600">Siapkan dana kas sebelum tanggal jatuh tempo distributor tiba</td>
        </tr>
        <tr class="hover:bg-blue-50/40 cursor-pointer transition-colors" @click="emit('navigate-tab', 'shifts')">
          <td class="text-center font-mono font-bold text-blue-700">09</td>
          <td class="font-bold text-red-800 flex items-center justify-between">
            <span>Pemeriksaan Kasir &amp; Selisih Kas Laci</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Buka Modul ↗
            </span>
          </td>
          <td>Mencocokkan fisik uang laci vs hitungan kasir</td>
          <td class="text-right font-mono font-bold text-gray-700">
            {{ shiftCount }} Shift Tercatat
          </td>
          <td class="text-gray-600">Cek langsung bila ada kasir yang uang lacinya sering tekor atau tidak pas</td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>
