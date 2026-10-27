<script setup lang="ts">
import { ref, computed } from 'vue';
import { ShieldCheck, LogOut, LogIn, Eye, ArrowUp, ArrowDown } from 'lucide-vue-next';
import { useShiftStore } from '../../../stores/shiftStore';
import { formatRupiah } from '../../../utils/formatters';

type ShiftSortField = 'cashierName' | 'startTime' | 'startingCash' | 'cashSales' | 'cashOutflow' | 'expectedCash' | 'actualCash' | 'discrepancy' | 'status';
type SortDirection = 'asc' | 'desc';

const shiftStore = useShiftStore();

const sortField = ref<ShiftSortField>('startTime');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: ShiftSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = (field === 'startTime' || field === 'discrepancy' || field === 'expectedCash' || field === 'actualCash' || field === 'cashSales') ? 'desc' : 'asc';
  }
}

const sortedShifts = computed(() => {
  const list = [...shiftStore.shiftHistory];
  const dir = sortDirection.value === 'asc' ? 1 : -1;
  const field = sortField.value;

  return list.sort((a, b) => {
    if (field === 'cashierName') return a.cashierName.localeCompare(b.cashierName) * dir;
    if (field === 'startTime') return a.startTime.localeCompare(b.startTime) * dir;
    if (field === 'startingCash') return (a.startingCash - b.startingCash) * dir;
    if (field === 'cashSales') return (a.cashSales - b.cashSales) * dir;
    if (field === 'cashOutflow') return (a.cashOutflow - b.cashOutflow) * dir;
    if (field === 'expectedCash') return (a.expectedCash - b.expectedCash) * dir;
    if (field === 'actualCash') return ((a.actualCash || 0) - (b.actualCash || 0)) * dir;
    if (field === 'discrepancy') return ((a.discrepancy || 0) - (b.discrepancy || 0)) * dir;
    if (field === 'status') return a.status.localeCompare(b.status) * dir;
    return 0;
  });
});
</script>

<template>
  <div class="flex-1 overflow-auto flex flex-col">
    <!-- Top Toolbar within Shifts Tab -->
    <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
          <ShieldCheck :size="14" class="text-blue-600" />
          Riwayat Pergantian Kasir (Shift) &amp; Uang Laci
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
      <table class="table-explorer w-full min-w-[1180px] whitespace-nowrap">
        <thead>
          <tr>
            <th class="w-12 text-center select-none">NO</th>

            <th
              class="is-sortable w-36 text-left whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'cashierName' }"
              title="Klik untuk mengurutkan nama kasir"
              @click="toggleSort('cashierName')"
            >
              <div class="flex items-center gap-1">
                <span>NAMA KASIR</span>
                <ArrowUp v-if="sortField === 'cashierName' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'cashierName' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-64 text-left whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'startTime' }"
              title="Klik untuk mengurutkan waktu shift"
              @click="toggleSort('startTime')"
            >
              <div class="flex items-center gap-1">
                <span>WAKTU KERJA</span>
                <ArrowUp v-if="sortField === 'startTime' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'startTime' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-28 text-right"
              :class="{ 'is-sorted': sortField === 'startingCash' }"
              title="Klik untuk mengurutkan modal awal"
              @click="toggleSort('startingCash')"
            >
              <div class="flex items-center justify-end gap-1">
                <span>MODAL AWAL</span>
                <ArrowUp v-if="sortField === 'startingCash' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'startingCash' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-32 text-right"
              :class="{ 'is-sorted': sortField === 'cashSales' }"
              title="Klik untuk mengurutkan penjualan tunai"
              @click="toggleSort('cashSales')"
            >
              <div class="flex items-center justify-end gap-1">
                <span>PENJUALAN TUNAI</span>
                <ArrowUp v-if="sortField === 'cashSales' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'cashSales' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-28 text-right"
              :class="{ 'is-sorted': sortField === 'cashOutflow' }"
              title="Klik untuk mengurutkan biaya keluar"
              @click="toggleSort('cashOutflow')"
            >
              <div class="flex items-center justify-end gap-1">
                <span>BIAYA KELUAR</span>
                <ArrowUp v-if="sortField === 'cashOutflow' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'cashOutflow' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-32 text-right"
              :class="{ 'is-sorted': sortField === 'expectedCash' }"
              title="Klik untuk mengurutkan uang seharusnya"
              @click="toggleSort('expectedCash')"
            >
              <div class="flex items-center justify-end gap-1">
                <span>UANG SEHARUSNYA</span>
                <ArrowUp v-if="sortField === 'expectedCash' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'expectedCash' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-32 text-right"
              :class="{ 'is-sorted': sortField === 'actualCash' }"
              title="Klik untuk mengurutkan uang asli laci"
              @click="toggleSort('actualCash')"
            >
              <div class="flex items-center justify-end gap-1">
                <span>UANG ASLI DI LACI</span>
                <ArrowUp v-if="sortField === 'actualCash' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'actualCash' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-36 text-center"
              :class="{ 'is-sorted': sortField === 'discrepancy' }"
              title="Klik untuk mengurutkan selisih/tekor"
              @click="toggleSort('discrepancy')"
            >
              <div class="flex items-center justify-center gap-1">
                <span>SELISIH (PAS / TEKOR)</span>
                <ArrowUp v-if="sortField === 'discrepancy' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'discrepancy' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th class="text-left select-none">CATATAN KASIR</th>

            <th
              class="is-sortable w-24 text-center"
              :class="{ 'is-sorted': sortField === 'status' }"
              title="Klik untuk mengurutkan status shift"
              @click="toggleSort('status')"
            >
              <div class="flex items-center justify-center gap-1">
                <span>STATUS</span>
                <ArrowUp v-if="sortField === 'status' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'status' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th class="w-24 text-center select-none">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <!-- Active Shift Row (if open) -->
          <tr v-if="shiftStore.isShiftActive" class="bg-emerald-50/60 font-semibold border-l-4 border-l-emerald-500 whitespace-nowrap">
            <td class="text-center font-mono text-emerald-800 whitespace-nowrap">AKTIF</td>
            <td class="font-bold text-gray-900 whitespace-nowrap">
              <div class="flex items-center gap-1.5 whitespace-nowrap">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{{ shiftStore.currentShift?.cashierName }}</span>
              </div>
            </td>
            <td class="text-[11px] whitespace-nowrap">
              <span>{{ new Date(shiftStore.currentShift?.startTime || '').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }} s/d Sekarang</span>
              <span class="text-emerald-700 font-mono ml-1.5 font-bold">({{ shiftStore.shiftDuration }})</span>
            </td>
            <td class="text-right font-mono whitespace-nowrap">Rp {{ formatRupiah(shiftStore.currentShift?.startingCash || 0) }}</td>
            <td class="text-right font-mono text-emerald-700 font-bold whitespace-nowrap">Rp {{ formatRupiah(shiftStore.currentShift?.cashSales || 0) }}</td>
            <td class="text-right font-mono text-amber-700 whitespace-nowrap">-Rp {{ formatRupiah(shiftStore.currentShift?.cashOutflow || 0) }}</td>
            <td class="text-right font-mono font-bold text-blue-800 whitespace-nowrap">Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}</td>
            <td class="text-right font-mono text-gray-400 italic whitespace-nowrap">Sedang Berjalan</td>
            <td class="text-center whitespace-nowrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                SEDANG BUKA
              </span>
            </td>
            <td class="text-gray-500 text-[11px] truncate max-w-xs whitespace-nowrap">{{ shiftStore.currentShift?.notes || '-' }}</td>
            <td class="text-center whitespace-nowrap">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white whitespace-nowrap">BUKA</span>
            </td>
            <td class="text-center whitespace-nowrap">
              <button
                type="button"
                class="px-2 py-1 text-[11px] rounded bg-white border border-gray-300 hover:bg-gray-100 text-rose-700 font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                @click="shiftStore.showCloseShiftModal = true"
              >
                Tutup
              </button>
            </td>
          </tr>

          <!-- History Rows -->
          <tr
            v-for="(s, idx) in sortedShifts"
            :key="s.id"
            class="hover:bg-blue-50/20 transition-colors whitespace-nowrap"
          >
            <td class="text-center font-mono text-gray-400 whitespace-nowrap">{{ idx + 1 }}</td>
            <td class="font-semibold text-gray-900 whitespace-nowrap">{{ s.cashierName }}</td>
            <td class="text-[11px] text-gray-600 whitespace-nowrap font-mono">
              {{ new Date(s.startTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }} {{ new Date(s.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }} - {{ s.endTime ? new Date(s.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-' }}
            </td>
            <td class="text-right font-mono text-gray-600 whitespace-nowrap">Rp {{ formatRupiah(s.startingCash) }}</td>
            <td class="text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">Rp {{ formatRupiah(s.cashSales) }}</td>
            <td class="text-right font-mono text-amber-700 whitespace-nowrap">{{ s.cashOutflow > 0 ? `-Rp ${formatRupiah(s.cashOutflow)}` : 'Rp 0' }}</td>
            <td class="text-right font-mono font-bold text-gray-800 whitespace-nowrap">Rp {{ formatRupiah(s.expectedCash) }}</td>
            <td class="text-right font-mono font-bold text-blue-900 whitespace-nowrap">Rp {{ formatRupiah(s.actualCash || 0) }}</td>
            <td class="text-center whitespace-nowrap">
              <span
                class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block whitespace-nowrap"
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
                    ? 'PAS (Cocok)'
                    : (s.discrepancy || 0) < 0
                      ? `TEKOR -Rp ${formatRupiah(Math.abs(s.discrepancy || 0))}`
                      : `LEBIH +Rp ${formatRupiah(s.discrepancy || 0)}`
                }}
              </span>
            </td>
            <td class="text-gray-600 text-[11px] truncate max-w-xs whitespace-nowrap">{{ s.notes || '-' }}</td>
            <td class="text-center whitespace-nowrap">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
                :class="s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
              >
                {{ s.status === 'OPEN' ? 'BUKA' : 'SELESAI' }}
              </span>
            </td>
            <td class="text-center whitespace-nowrap">
              <button
                type="button"
                class="px-2 py-0.5 text-[11px] rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1 mx-auto whitespace-nowrap"
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
              <p class="font-bold text-gray-600 text-xs">Belum ada riwayat kerja shift kasir yang tersimpan</p>
              <p class="text-[11px] mt-1">Buka shift kasir untuk mulai merekam serah terima dan kecocokan uang laci.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
