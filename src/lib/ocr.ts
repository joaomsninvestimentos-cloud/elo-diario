import { createWorker, type Worker } from 'tesseract.js';
import type { Stroke } from './types';
import { PAGE_WIDTH, renderInk } from './ink';

/** Deixa a página de tinta pronta para OCR: fundo branco, traço preto, alto contraste. */
export const inkToImageData = (ink: Stroke[], maxWidth = 1600): ImageData | null => {
  if (!ink.length) return null;
  const ratio = 1.6;
  const width = Math.min(maxWidth, PAGE_WIDTH * 2);
  const height = Math.round(width * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const scale = width / PAGE_WIDTH;
  renderInk(canvas, ink.map((stroke) => ({ ...stroke, color: '#000000' })), scale);

  // contraste: qualquer pixel claro vira branco puro, o resto vira preto
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const value = luma > 150 ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  return image;
};

let workerPromise: Promise<Worker> | null = null;
let progressHandler: ((progress: number) => void) | null = null;

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('por', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            progressHandler?.(message.progress ?? 0);
          }
        },
      });
      return worker;
    })();
  }
  return workerPromise;
};

export const extractText = async (
  ink: Stroke[],
  onProgress?: (progress: number) => void,
): Promise<string> => {
  const image = inkToImageData(ink);
  if (!image) return '';

  const width = image.width;
  const height = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.putImageData(image, 0, 0);

  progressHandler = (progress) => onProgress?.(progress);
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    return data.text.replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    progressHandler = null;
  }
};
