import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Supplier } from '../types';

const STORAGE_KEY_SUPPLIERS = 'kasir_citra_suppliers_v1';

export const useSupplierStore = defineStore('supplier', () => {
  const showSupplierDrawer = ref(false);
  const activeSupplierForDrawer = ref<Supplier | null>(null);

  const saved = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
  const suppliers = ref<Supplier[]>(saved ? JSON.parse(saved) : []);

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers.value));
  }

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
  }

  function deleteSupplier(id: string) {
    suppliers.value = suppliers.value.filter(s => s.id !== id);
    saveLocal();
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
    deleteSupplier
  };
});
