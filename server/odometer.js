import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './db.js';

const CACHE = path.join(DATA_DIR, 'tessdata');

/** Pick the odometer km from OCR text. Tenths are dropped. A known last reading breaks ties. */
export function pickOdometerReading(text, hint) {
  const cleaned = String(text || '')
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[,\s](?=\d{3}\b)/g, '');
  const found = [];
  const re = /\d{4,7}(?:\.\d{1,2})?/g;
  let match;
  while ((match = re.exec(cleaned))) {
    const km = Math.floor(Number(match[0]));
    if (km >= 1 && km <= 9999999) found.push(km);
  }
  const unique = [...new Set(found)];
  if (!unique.length) return null;
  const hintKm = Number(hint);
  if (hintKm > 0) {
    const near = unique.filter(n => n >= hintKm - 30 && n <= hintKm + 15000);
    if (near.length) {
      near.sort((a, b) => Math.abs(a - hintKm) - Math.abs(b - hintKm) || b - a);
      return near[0];
    }
  }
  const preferred = unique.filter(n => String(n).length >= 5 && String(n).length <= 6);
  return Math.max(...(preferred.length ? preferred : unique));
}

let workerPromise;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      fs.mkdirSync(CACHE, { recursive: true });
      return createWorker('eng', 1, { cachePath: CACHE, errorHandler: () => {} });
    })().catch(err => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function readOdometerPhoto(filePath, hint) {
  const worker = await getWorker();
  let best = null;
  for (const psm of ['6', '11', '7']) {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.',
      tessedit_pageseg_mode: psm,
      user_defined_dpi: '300'
    });
    const { data } = await worker.recognize(filePath);
    const reading = pickOdometerReading(data.text, hint);
    const attempt = { reading, confidence: Math.round(data.confidence || 0), raw: (data.text || '').replace(/\s+/g, ' ').trim().slice(0, 200) };
    if (reading != null && (!best || best.reading == null || attempt.confidence > best.confidence)) best = attempt;
    if (reading != null && attempt.confidence >= 60) break;
  }
  return best || { reading: null, confidence: 0, raw: '' };
}
