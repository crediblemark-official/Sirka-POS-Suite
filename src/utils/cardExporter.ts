import { toPng } from 'html-to-image';
import { dbService } from '../services/dbService';
import { Buyer } from '../types';

export function getMemberCardFilename(
  buyer: Partial<Buyer>,
  side: 'depan' | 'belakang' | 'kedua_sisi'
): string {
  const safeName = (buyer.name || 'member')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const safeNo = (buyer.memberCardNo || buyer.code || 'card')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return `kartu-member-${safeName}-${safeNo}-${side}.png`;
}

export async function exportElementToPng(
  element: HTMLElement,
  filename: string,
  pixelRatio = 3
): Promise<string | null> {
  // Ensure document fonts are loaded before capturing
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    quality: 1,
  });

  // Convert base64 dataUrl to bytes
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 1. Try Tauri native save via Explorer Dialog
  try {
    const res = await dbService.saveExportFile(filename, Array.from(bytes));
    return res;
  } catch (err: any) {
    const errStr = String(err?.message || err);
    // User cancelled in native explorer dialog
    if (errStr.includes('CANCELLED')) {
      return null;
    }

    // 2. Fallback to Browser File System Access API (Show native save file dialog in web)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Gambar PNG (*.png)',
              accept: { 'image/png': ['.png'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([bytes], { type: 'image/png' }));
        await writable.close();
        return `File berhasil disimpan.`;
      } catch (pickerErr: any) {
        if (pickerErr?.name === 'AbortError') {
          return null; // User cancelled
        }
      }
    }

    // 3. Fallback to direct anchor download
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return `File ${filename} berhasil diunduh.`;
  }
}
