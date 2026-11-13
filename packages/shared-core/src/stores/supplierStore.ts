import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Supplier } from '@sirka/shared-types';
import { safeParse } from '@sirka/shared-utils';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';

const STORAGE_KEY_SUPPLIERS = 'sirka_pos_suppliers_v1';
const SETTING_KEY_SUPPLIERS = 'suppliers_master';

export const useSupplierStore = defineStore('supplier', () => {
  const showSupplierDrawer = ref(false);
  const activeSupplierForDrawer = ref<Supplier | null>(null);

  const saved = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
  const suppliers = ref<Supplier[]>(safeParse<Supplier[]>(saved, [], 'SupplierStore'));

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers.value));
  }

  async function syncToDb() {
    const payload = JSON.stringify(suppliers.value);
    try {
      await dbService.updateSetting(SETTING_KEY_SUPPLIERS, payload);
    } catch {
      syncService.enqueue('UPDATE_SETTING', { key: SETTING_KEY_SUPPLIERS, value: payload });
    }
  }

  async function fetchFromDb() {
    try {
      const settings = await dbService.getSettings();
      const raw = settings?.find(s => s.key === SETTING_KEY_SUPPLIERS)?.value;
      if (!raw) return;
      const remote = safeParse<Supplier[]>(raw, [], 'SupplierStore');
      if (Array.isArray(remote) && remote.length > 0) {
        const remoteIds = new Set(remote.map(s => s.id));
        const localOnly = suppliers.value.filter(s => s && s.id && !remoteIds.has(s.id));
        suppliers.value = [...remote, ...localOnly];
        saveLocal();
      }
    } catch {
      // Offline: tetap gunakan cache lokal
    }
  }

  fetchFromDb();

  function getSupplierByName(name: string): Supplier | undefined {
    const clean = name.trim().toLowerCase();
    return suppliers.value.find(s => s.name.trim().toLowerCase() === clean);
  }

  function getSupplierById(id: string): Supplier | undefined {
    return suppliers.value.find(s => s.id === id);
  }

  function addSupplier(data: Omit<Supplier, 'id' | 'createdAt'>): Supplier {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('Nama supplier wajib diisi');

    const existing = getSupplierByName(cleanName);
    if (existing) {
      throw new Error(`Supplier dengan nama "${cleanName}" sudah ada`);
    }

    const newSupplier: Supplier = {
      id: `supp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      phone: data.phone?.trim() || '',
      contactPerson: data.contactPerson?.trim() || '',
      address: data.address?.trim() || '',
      notes: data.notes?.trim() || '',
      createdAt: new Date().toISOString()
    };

    suppliers.value = [newSupplier, ...suppliers.value];
    saveLocal();
    syncToDb();
    return newSupplier;
  }

  function updateSupplier(id: string, updates: Partial<Omit<Supplier, 'id' | 'createdAt'>>) {
    const idx = suppliers.value.findIndex(s => s.id === id);
    if (idx === -1) return;

    if (updates.name && updates.name.trim()) {
      const cleanName = updates.name.trim();
      const duplicate = suppliers.value.find(s => s.id !== id && s.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (duplicate) {
        throw new Error(`Nama supplier "${cleanName}" sudah digunakan oleh supplier lain`);
      }
      suppliers.value[idx].name = cleanName;
    }

    if (updates.phone !== undefined) suppliers.value[idx].phone = updates.phone.trim();
    if (updates.contactPerson !== undefined) suppliers.value[idx].contactPerson = updates.contactPerson.trim();
    if (updates.address !== undefined) suppliers.value[idx].address = updates.address.trim();
    if (updates.notes !== undefined) suppliers.value[idx].notes = updates.notes.trim();

    saveLocal();
    syncToDb();
  }

  function deleteSupplier(id: string) {
    suppliers.value = suppliers.value.filter(s => s.id !== id);
    saveLocal();
    syncToDb();
    if (activeSupplierForDrawer.value?.id === id) {
      activeSupplierForDrawer.value = null;
      showSupplierDrawer.value = false;
    }
  }

  return {
    suppliers,
    showSupplierDrawer,
    activeSupplierForDrawer,
    getSupplierByName,
    getSupplierById,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    fetchFromDb
  };
});
