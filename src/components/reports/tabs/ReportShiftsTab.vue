<script setup lang="ts">
import { ShieldCheck, LogOut, LogIn, Eye } from 'lucide-vue-next';
import { useShiftStore } from '../../../stores/shiftStore';
import { formatRupiah } from '../../../utils/formatters';

const shiftStore = useShiftStore();
</script>

<template>
  <div class="flex-1 overflow-auto flex flex-col">
    <!-- Top Toolbar within Shifts Tab -->
    <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
          <ShieldCheck :size="14" class="text-blue-600" />
          Rekam Jejak Tutup Shift Kasir &amp; Rekonsiliasi Kas Laci
        </span>
        <span class="text-[11px] text-gray-500 font-mono">({{ shiftStore.shiftHistory.length }} Riwayat)</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="shiftStore.isShiftActive"
          type="button"
          class="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          @click="shiftStore.showCloseShiftModal = true"
        >
          <LogOut :size="13" />
          <span>Tutup Shift Kasir ({{ shiftStore.currentShift?.cashierName }})</span>
        </button>
        <button
          v-else
          type="button"
          class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          @click="shiftStore.showOpenShiftModal = true"
        >
          <LogIn :size="13" />
          <span>Buka Shift Baru</span>
        </button>
      </div>
    </div>

    <!-- Edge-to-Edge Shift Audit Table -->
    <div class="flex-1 overflow-auto">
      <table class="table-explorer w-full">
        <thead>
          <tr>
            <th class="w-12 text-center">NO</th>
            <th class="w-36 text-left">KASIR</th>
            <th class="w-56 text-left">WAKTU SHIFT &amp; DURASI</th>
            <th class="w-28 text-right">MODAL AWAL</th>
            <th class="w-32 text-right">PENJUALAN TUNAI</th>
            <th class="w-28 text-right">KAS KELUAR</th>
            <th class="w-32 text-right">KAS SISTEM</th>
            <th class="w-32 text-right">FISIK LACI</th>
            <th class="w-36 text-center">SELISIH KAS</th>
            <th class="text-left">CATATAN SERAH TERIMA</th>
            <th class="w-24 text-center">STATUS</th>
            <th class="w-24 text-center">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <!-- Active Shift Row (if open) -->
          <tr v-if="shiftStore.isShiftActive" class="bg-emerald-50/60 font-semibold border-l-4 border-l-emerald-500">
            <td class="text-center font-mono text-emerald-800">AKTIF</td>
            <td class="font-bold text-gray-900">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{{ shiftStore.currentShift?.cashierName }}</span>
              </div>
            </td>
            <td class="text-[11px]">
              <span>{{ new Date(shiftStore.currentShift?.startTime || '').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }} s/d Sekarang</span>
              <span class="text-emerald-700 font-mono ml-1.5 font-bold">({{ shiftStore.shiftDuration }})</span>
            </td>
            <td class="text-right font-mono">Rp {{ formatRupiah(shiftStore.currentShift?.startingCash || 0) }}</td>
            <td class="text-right font-mono text-emerald-700 font-bold">Rp {{ formatRupiah(shiftStore.currentShift?.cashSales || 0) }}</td>
            <td class="text-right font-mono text-amber-700">-Rp {{ formatRupiah(shiftStore.currentShift?.cashOutflow || 0) }}</td>
            <td class="text-right font-mono font-bold text-blue-800">Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}</td>
            <td class="text-right font-mono text-gray-400 italic">Sedang Berjalan</td>
            <td class="text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                SEDANG BUKA
              </span>
            </td>
            <td class="text-gray-500 text-[11px] truncate max-w-xs">{{ shiftStore.currentShift?.notes || '-' }}</td>
            <td class="text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">OPEN</span>
            </td>
            <td class="text-center">
              <button
                type="button"
                class="px-2 py-1 text-[11px] rounded bg-white border border-gray-300 hover:bg-gray-100 text-rose-700 font-bold cursor-pointer transition-colors shadow-2xs"
                @click="shiftStore.showCloseShiftModal = true"
              >
                Tutup
              </button>
            </td>
          </tr>

          <!-- History Rows -->
          <tr
            v-for="(s, idx) in shiftStore.shiftHistory"
            :key="s.id"
            class="hover:bg-blue-50/20 transition-colors"
          >
            <td class="text-center font-mono text-gray-400">{{ idx + 1 }}</td>
            <td class="font-semibold text-gray-900">{{ s.cashierName }}</td>
            <td class="text-[11px] text-gray-600">
              <div class="font-mono">
                {{ new Date(s.startTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
                {{ new Date(s.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
                -
                {{ s.endTime ? new Date(s.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-' }}
              </div>
            </td>
            <td class="text-right font-mono text-gray-600">Rp {{ formatRupiah(s.startingCash) }}</td>
            <td class="text-right font-mono text-emerald-700 font-semibold">Rp {{ formatRupiah(s.cashSales) }}</td>
            <td class="text-right font-mono text-amber-700">{{ s.cashOutflow > 0 ? `-Rp ${formatRupiah(s.cashOutflow)}` : 'Rp 0' }}</td>
            <td class="text-right font-mono font-bold text-gray-800">Rp {{ formatRupiah(s.expectedCash) }}</td>
            <td class="text-right font-mono font-bold text-blue-900">Rp {{ formatRupiah(s.actualCash || 0) }}</td>
            <td class="text-center">
              <span
                class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block"
                :class="
                  (s.discrepancy || 0) === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : (s.discrepancy || 0) < 0
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                "
              >
                {{
                  (s.discrepancy || 0) === 0
                    ? 'PAS (Rp 0)'
                    : `${(s.discrepancy || 0) > 0 ? '+' : ''}Rp ${formatRupiah(s.discrepancy || 0)}`
                }}
              </span>
            </td>
            <td class="text-gray-600 text-[11px] truncate max-w-xs">{{ s.notes || '-' }}</td>
            <td class="text-center">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                :class="s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
              >
                {{ s.status }}
              </span>
            </td>
            <td class="text-center">
              <button
                type="button"
                class="px-2 py-0.5 text-[11px] rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1 mx-auto"
                title="Lihat Struk Serah Terima"
                @click="
                  shiftStore.lastClosedShift = s;
                  shiftStore.showShiftSummaryModal = true;
                "
              >
                <Eye :size="12" />
                <span>Struk</span>
              </button>
            </td>
          </tr>

          <!-- Empty State -->
          <tr v-if="shiftStore.shiftHistory.length === 0 && !shiftStore.isShiftActive">
            <td colspan="12" class="p-8 text-center text-gray-400">
              <p class="font-bold text-gray-600 text-xs">Belum ada riwayat shift yang tersimpan</p>
              <p class="text-[11px] mt-1">Buka shift kasir untuk mulai merekam serah terima dan rekonsiliasi kas</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
