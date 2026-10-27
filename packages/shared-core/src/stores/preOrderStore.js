import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';
import { safeParse } from '@sirka/shared-utils';
const STORAGE_KEY_PREORDERS = 'kasir_citra_preorders_v2';
export const usePreOrderStore = defineStore('preOrder', () => {
    const showPreOrderSidebar = ref(false);
    const activeScheduleForSidebar = ref(null);
    const saved = localStorage.getItem(STORAGE_KEY_PREORDERS);
    const schedules = ref(safeParse(saved, [], 'PreOrderStore'));
    function saveLocal() {
        localStorage.setItem(STORAGE_KEY_PREORDERS, JSON.stringify(schedules.value));
    }
    async function fetchPreOrdersFromDb() {
        try {
            const data = await dbService.getPreOrders();
            schedules.value = data || [];
            saveLocal();
        }
        catch (e) {
            console.warn('[Sync] Using local pre-orders cache:', e);
        }
    }
    fetchPreOrdersFromDb();
    function getSchedule(date, buyer) {
        return schedules.value.find(s => s.date === date && s.buyer === buyer);
    }
    function filterSchedules(buyerFilter, categoryFilter) {
        return schedules.value.filter(s => {
            const matchBuyer = !buyerFilter || buyerFilter === 'Semua' || s.buyer === buyerFilter;
            // BUG FIX: jadwal lama/parse rusak tidak punya array `items` -> accessing
            // `.some` melempar TypeError yang mematikan seluruh filter.
            const items = Array.isArray(s.items) ? s.items : [];
            const matchCategory = !categoryFilter || categoryFilter === 'Semua' || items.some(i => i.category === categoryFilter);
            return matchBuyer && matchCategory;
        });
    }
    async function addSchedule(scheduleData) {
        const id = ('id' in scheduleData && scheduleData.id) ? scheduleData.id : `po-${Date.now()}`;
        const newSchedule = {
            ...scheduleData,
            id
        };
        schedules.value.unshift(newSchedule);
        saveLocal();
        try {
            await dbService.savePreOrder(newSchedule);
        }
        catch (err) {
            console.warn('[Sync] Offline: enqueued preorder for sync:', err);
            syncService.enqueue('SAVE_PREORDER', { record: newSchedule });
        }
        return newSchedule;
    }
    async function updateSchedule(schedule) {
        const idx = schedules.value.findIndex(s => s.id === schedule.id);
        if (idx !== -1) {
            schedules.value[idx] = { ...schedule };
            saveLocal();
            try {
                await dbService.savePreOrder(schedule);
            }
            catch (err) {
                console.warn('[Sync] Offline: enqueued update preorder for sync:', err);
                syncService.enqueue('SAVE_PREORDER', { record: schedule });
            }
        }
    }
    async function deleteSchedule(id) {
        schedules.value = schedules.value.filter(s => s.id !== id);
        saveLocal();
        try {
            await dbService.deletePreOrder(id);
        }
        catch (err) {
            console.warn('[Sync] Offline: enqueued delete preorder for sync:', err);
            syncService.enqueue('DELETE_PREORDER', { id });
        }
    }
    return {
        showPreOrderSidebar,
        activeScheduleForSidebar,
        schedules,
        saveLocal,
        fetchPreOrdersFromDb,
        getSchedule,
        filterSchedules,
        addSchedule,
        updateSchedule,
        deleteSchedule
    };
});
