import { PreOrderSchedule } from '../types';

export const INITIAL_PREORDERS: PreOrderSchedule[] = [
  // Senin, 12 Okt 2026
  {
    id: 'po-20261012-banjarsari',
    date: '2026-10-12',
    dayName: 'Senin',
    buyer: 'Pembeli Banjarsari',
    items: [
      { id: 'poi-1', productName: 'AYAM POTONG AP (10)', category: 'Fadhil Food', qty: 150, unit: 'KG', packagingNote: '150 KG' },
      { id: 'poi-2', productName: 'BERAS RAMOS PREMIUM 25 KG', category: 'Koko Didid', qty: 4, unit: 'SAK', packagingNote: '4 Sak (100 KG)' },
      { id: 'poi-3', productName: 'WORTEL LOKAL MANIS', category: 'Sayur Tufel', qty: 25, unit: 'KG', packagingNote: '25 KG' },
      { id: 'poi-4', productName: 'BAWANG MERAH KUPAS BERSIH', category: 'Haff Pro Jaya', qty: 15, unit: 'KG', packagingNote: '15 KG' },
      { id: 'poi-5', productName: 'SARUNG TANGAN LATEX', category: 'APD & Sabun', qty: 33, unit: 'BOX', packagingNote: '33 Box' },
    ]
  },
  {
    id: 'po-20261012-pahlawan',
    date: '2026-10-12',
    dayName: 'Senin',
    buyer: 'Pembeli Pahlawan',
    items: [
      { id: 'poi-6', productName: 'AYAM POTONG AP (10)', category: 'Fadhil Food', qty: 120, unit: 'KG', packagingNote: '120 KG' },
      { id: 'poi-7', productName: 'BERAS RAMOS PREMIUM 25 KG', category: 'Koko Didid', qty: 3, unit: 'SAK', packagingNote: '3 Sak (75 KG)' },
      { id: 'poi-8', productName: 'BUNCIS SUPER', category: 'Sayur Tufel', qty: 20, unit: 'KG', packagingNote: '20 KG' },
      { id: 'poi-9', productName: 'SARUNG TANGAN LATEX', category: 'APD & Sabun', qty: 35, unit: 'BOX', packagingNote: '35 Box' },
    ]
  },
  {
    id: 'po-20261012-mangunharjo',
    date: '2026-10-12',
    dayName: 'Senin',
    buyer: 'Pembeli Mangunharjo',
    items: [
      { id: 'poi-10', productName: 'AYAM POTONG AP (10)', category: 'Fadhil Food', qty: 110, unit: 'KG', packagingNote: '110 KG' },
      { id: 'poi-11', productName: 'BERAS RAMOS PREMIUM 25 KG', category: 'Koko Didid', qty: 3, unit: 'SAK', packagingNote: '3 Sak (75 KG)' },
      { id: 'poi-12', productName: 'KANGKUNG SEGAR', category: 'Sayur Tufel', qty: 80, unit: 'IKAT', packagingNote: '80 Ikat' },
      { id: 'poi-13', productName: 'SUNLIGHT 5 LITER JERIGEN', category: 'APD & Sabun', qty: 2, unit: 'JERIGEN', packagingNote: '2 Jerigen' },
    ]
  },

  // Selasa, 13 Okt 2026
  {
    id: 'po-20261013-banjarsari',
    date: '2026-10-13',
    dayName: 'Selasa',
    buyer: 'Pembeli Banjarsari',
    items: [
      { id: 'poi-14', productName: 'DAGING SAPI SEGAR GILING', category: 'Fadhil Food', qty: 45, unit: 'KG', packagingNote: '45 KG' },
      { id: 'poi-15', productName: 'TAHU PUTIH SUPER BESAR', category: 'Haff Pro Jaya', qty: 12, unit: 'PAPAN', packagingNote: '12 Papan' },
      { id: 'poi-16', productName: 'APEL FUJI 2500', category: 'Pantry Co', qty: 6, unit: 'KARTON', packagingNote: '6 Karton' },
      { id: 'poi-17', productName: 'KECAP MANIS BANGO 1 KG', category: 'Hari Barokah', qty: 10, unit: 'POUCH', packagingNote: '10 Pouch' },
    ]
  },
  {
    id: 'po-20261013-pahlawan',
    date: '2026-10-13',
    dayName: 'Selasa',
    buyer: 'Pembeli Pahlawan',
    items: [
      { id: 'poi-18', productName: 'DAGING SAPI SEGAR GILING', category: 'Fadhil Food', qty: 35, unit: 'KG', packagingNote: '35 KG' },
      { id: 'poi-19', productName: 'TEMPE BALOK DAUN SPESIAL', category: 'Haff Pro Jaya', qty: 30, unit: 'BATANG', packagingNote: '30 Batang' },
      { id: 'poi-20', productName: 'APEL FUJI 2500', category: 'Pantry Co', qty: 4, unit: 'KARTON', packagingNote: '4 Karton' },
    ]
  },
  {
    id: 'po-20261013-mangunharjo',
    date: '2026-10-13',
    dayName: 'Selasa',
    buyer: 'Pembeli Mangunharjo',
    items: [
      { id: 'poi-21', productName: 'DAGING SAPI SEGAR GILING', category: 'Fadhil Food', qty: 30, unit: 'KG', packagingNote: '30 KG' },
      { id: 'poi-22', productName: 'APEL FUJI 2500', category: 'Pantry Co', qty: 3, unit: 'KARTON', packagingNote: '3 Karton' },
      { id: 'poi-23', productName: 'SOKLIN LANTAI 780 ML', category: 'APD & Sabun', qty: 6, unit: 'POUCH', packagingNote: '6 Pouch' },
    ]
  },

  // Rabu, 14 Okt 2026
  {
    id: 'po-20261014-banjarsari',
    date: '2026-10-14',
    dayName: 'Rabu',
    buyer: 'Pembeli Banjarsari',
    items: [
      { id: 'poi-24', productName: 'TELUR AYAM NEGERI 1 TRAY (30 BUTIR)', category: 'Fadhil Food', qty: 25, unit: 'TRAY', packagingNote: '25 Tray (750 Butir)' },
      { id: 'poi-25', productName: 'BAYAM HIJAU SEGAR', category: 'Sayur Tufel', qty: 90, unit: 'IKAT', packagingNote: '90 Ikat' },
      { id: 'poi-26', productName: 'TEPUNG JEMPOL SPESIAL', category: 'Hari Barokah', qty: 25, unit: 'KG', packagingNote: '25 KG' },
    ]
  },
  {
    id: 'po-20261014-pahlawan',
    date: '2026-10-14',
    dayName: 'Rabu',
    buyer: 'Pembeli Pahlawan',
    items: [
      { id: 'poi-27', productName: 'TELUR AYAM NEGERI 1 TRAY (30 BUTIR)', category: 'Fadhil Food', qty: 20, unit: 'TRAY', packagingNote: '20 Tray' },
      { id: 'poi-28', productName: 'MINYAK GORENG BIMOLI 2 LITER', category: 'Koko Didid', qty: 15, unit: 'POUCH', packagingNote: '15 Pouch' },
    ]
  },
  {
    id: 'po-20261014-mangunharjo',
    date: '2026-10-14',
    dayName: 'Rabu',
    buyer: 'Pembeli Mangunharjo',
    items: [
      { id: 'poi-29', productName: 'TELUR AYAM NEGERI 1 TRAY (30 BUTIR)', category: 'Fadhil Food', qty: 18, unit: 'TRAY', packagingNote: '18 Tray' },
      { id: 'poi-30', productName: 'PISANG AMBON SUPER', category: 'Pantry Co', qty: 20, unit: 'SISIR', packagingNote: '20 Sisir' },
    ]
  },

  // Kamis, 15 Okt 2026
  {
    id: 'po-20261015-banjarsari',
    date: '2026-10-15',
    dayName: 'Kamis',
    buyer: 'Pembeli Banjarsari',
    items: [
      { id: 'poi-31', productName: 'IKAN FILLET DORI', category: 'Fadhil Food', qty: 40, unit: 'KG', packagingNote: '40 KG' },
      { id: 'poi-32', productName: 'TEPUNG MAIZENA BOLA DELI 1 KG', category: 'Hari Barokah', qty: 10, unit: 'KG', packagingNote: '10 KG' },
      { id: 'poi-33', productName: 'LADA BUBUK SUPER 1 KG', category: 'Pak Agus', qty: 2, unit: 'KG', packagingNote: '2 KG' },
    ]
  },
  {
    id: 'po-20261015-pahlawan',
    date: '2026-10-15',
    dayName: 'Kamis',
    buyer: 'Pembeli Pahlawan',
    items: [
      { id: 'poi-34', productName: 'IKAN FILLET DORI', category: 'Fadhil Food', qty: 30, unit: 'KG', packagingNote: '30 KG' },
      { id: 'poi-35', productName: 'SAORI SAOS PANDA 1 KG', category: 'Hari Barokah', qty: 6, unit: 'POUCH', packagingNote: '6 Pouch' },
    ]
  },
  {
    id: 'po-20261015-mangunharjo',
    date: '2026-10-15',
    dayName: 'Kamis',
    buyer: 'Pembeli Mangunharjo',
    items: [
      { id: 'poi-36', productName: 'IKAN FILLET DORI', category: 'Fadhil Food', qty: 25, unit: 'KG', packagingNote: '25 KG' },
      { id: 'poi-37', productName: 'MELON HIJAU MANIS', category: 'Pantry Co', qty: 30, unit: 'KG', packagingNote: '30 KG' },
    ]
  },

  // Jumat, 16 Okt 2026
  {
    id: 'po-20261016-banjarsari',
    date: '2026-10-16',
    dayName: 'Jumat',
    buyer: 'Pembeli Banjarsari',
    items: [
      { id: 'poi-38', productName: 'AYAM POTONG AP (10)', category: 'Fadhil Food', qty: 160, unit: 'KG', packagingNote: '160 KG' },
      { id: 'poi-39', productName: 'SEMANGKA MERAH NON BIJI', category: 'Pantry Co', qty: 60, unit: 'KG', packagingNote: '60 KG' },
      { id: 'poi-40', productName: 'CABAI MERAH KERITING', category: 'Sayur Tufel', qty: 12, unit: 'KG', packagingNote: '12 KG' },
      { id: 'poi-41', productName: 'SARUNG TANGAN LATEX', category: 'APD & Sabun', qty: 17, unit: 'BOX', packagingNote: '17 Box' },
    ]
  },
  {
    id: 'po-20261016-pahlawan',
    date: '2026-10-16',
    dayName: 'Jumat',
    buyer: 'Pembeli Pahlawan',
    items: [
      { id: 'poi-42', productName: 'AYAM POTONG AP (10)', category: 'Fadhil Food', qty: 130, unit: 'KG', packagingNote: '130 KG' },
      { id: 'poi-43', productName: 'SEMANGKA MERAH NON BIJI', category: 'Pantry Co', qty: 50, unit: 'KG', packagingNote: '50 KG' },
      { id: 'poi-44', productName: 'SARUNG TANGAN LATEX', category: 'APD & Sabun', qty: 15, unit: 'BOX', packagingNote: '15 Box' },
    ]
  },
  {
    id: 'po-20261016-mangunharjo',
    date: '2026-10-16',
    dayName: 'Jumat',
    buyer: 'Pembeli Mangunharjo',
    items: [
      { id: 'poi-45', productName: 'AYAM POTONG AP (10)', category: 'Fadhil Food', qty: 120, unit: 'KG', packagingNote: '120 KG' },
      { id: 'poi-46', productName: 'SEMANGKA MERAH NON BIJI', category: 'Pantry Co', qty: 45, unit: 'KG', packagingNote: '45 KG' },
      { id: 'poi-47', productName: 'TOMAT BUAH MERAH', category: 'Sayur Tufel', qty: 15, unit: 'KG', packagingNote: '15 KG' },
    ]
  },
];
