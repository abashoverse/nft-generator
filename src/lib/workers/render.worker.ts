import type { Combination } from '$lib/types';

interface SerTrait {
	id: string;
	file: File | null;
}

interface SerLayer {
	name: string;
	traits: SerTrait[];
}

type WorkerRequest =
	| { type: 'init'; layers: SerLayer[] }
	| { type: 'render'; index: number; combo: Combination; size: number };

// `self` is the DedicatedWorkerGlobalScope; cast through `any` so we don't have
// to pull the WebWorker lib into the project's tsconfig just for this file.
const ctx = self as any;

let layers: SerLayer[] = [];
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;

// Decode each unique trait file once, then reuse the bitmap for every image.
const bitmaps = new Map<File, ImageBitmap>();

async function getBitmap(file: File): Promise<ImageBitmap> {
	let bmp = bitmaps.get(file);
	if (!bmp) {
		bmp = await createImageBitmap(file);
		bitmaps.set(file, bmp);
	}
	return bmp;
}

ctx.onmessage = async (event: MessageEvent) => {
	const msg = event.data as WorkerRequest;

	if (msg.type === 'init') {
		layers = msg.layers;
		return;
	}

	const { index, combo, size } = msg;
	try {
		if (!canvas || canvas.width !== size || canvas.height !== size) {
			canvas = new OffscreenCanvas(size, size);
			context = canvas.getContext('2d');
		}
		if (!context) throw new Error('OffscreenCanvas 2D context unavailable');

		context.clearRect(0, 0, size, size);
		for (let i = layers.length - 1; i >= 0; i--) {
			const trait = layers[i].traits.find((t) => t.id === combo[i]);
			if (!trait || !trait.file) continue;
			const bmp = await getBitmap(trait.file);
			context.drawImage(bmp, 0, 0, size, size);
		}

		const blob = await canvas.convertToBlob({ type: 'image/png' });
		ctx.postMessage({ type: 'result', index, blob });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		ctx.postMessage({ type: 'error', index, message });
	}
};
