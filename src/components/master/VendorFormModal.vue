<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, Plus } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: { name: string; defaultMarkup: number; description: string }): void;
}>();

const form = ref({
  name: '',
  defaultMarkup: 20,
  description: ''
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      form.value = {
        name: '',
        defaultMarkup: 20,
        description: ''
      };
    }
  }
);

function handleSubmit() {
  if (!form.value.name.trim()) return;
  emit('save', {
    name: form.value.name.trim(),
    defaultMarkup: Number(form.value.defaultMarkup) || 20,
    description: form.value.description.trim()
  });
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl border border-gray-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-sm text-gray-800">
        <div class="flex items-center gap-2">
          <Plus :size="16" class="text-emerald-600" />
          <span>Tambah Vendor / Kategori Baru</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-4 space-y-3">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Nama Vendor / Kategori *</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Misal: CV Sumber Rejeki / Buah Segar"
            required
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-bold"
          />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Default % Markup Keuntungan</label>
          <input
            v-model.number="form.defaultMarkup"
            type="number"
            step="0.5"
            min="0"
            max="100"
            required
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono font-bold text-emerald-700"
          />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Deskripsi / Catatan Barang</label>
          <input
            v-model="form.description"
            type="text"
            placeholder="Misal: Supplier telur, daging ayam, dll"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div class="pt-2.5 flex items-center justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs cursor-pointer transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="submit"
            class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            Simpan Vendor
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
