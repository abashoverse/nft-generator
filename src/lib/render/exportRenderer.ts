import type { Layer, Combination } from '$lib/types';

interface SerLayer {
	name: string;
	traits: { name: string; file: File }[];
}

type WorkerResponse =
	| { type: 'result'; index: number; blob: Blob }
	| { type: 'error'; index: number; message: string };

function serializeLayers(layers: Layer[]): SerLayer[] {
	return layers.map((layer) => ({
		name: layer.name,
		traits: layer.traits.map((t) => ({ name: t.file.name, file: t.file }))
	}));
}

function supportsWorkerRender(): boolean {
	return (
		typeof Worker !== 'undefined' &&
		typeof OffscreenCanvas !== 'undefined' &&
		typeof OffscreenCanvas.prototype.convertToBlob === 'function' &&
		typeof createImageBitmap === 'function'
	);
}

function poolSize(count: number): number {
	const cores = navigator.hardwareConcurrency || 4;
	// Leave a core for the UI/main thread, cap at 8 to bound memory (each worker
	// holds its own decoded bitmaps plus an export-sized canvas).
	return Math.max(1, Math.min(cores - 1, 8, count));
}

/**
 * Render an entire collection to an array of PNG blobs (indexed parallel to
 * `collection`). Uses a pool of OffscreenCanvas workers when the browser
 * supports it, and falls back to a cached main-thread renderer otherwise.
 */
export async function renderCollectionToBlobs(
	layers: Layer[],
	collection: Combination[],
	size: number,
	onProgress: (done: number) => void
): Promise<Blob[]> {
	if (collection.length === 0) return [];

	if (supportsWorkerRender()) {
		try {
			return await renderWithWorkers(layers, collection, size, onProgress);
		} catch (err) {
			// Module workers or OffscreenCanvas can fail in ways feature detection
			// misses. Fall back to the main thread so the export still completes.
			console.warn('Worker render failed, falling back to main thread:', err);
		}
	}

	return renderOnMainThread(layers, collection, size, onProgress);
}

function renderWithWorkers(
	layers: Layer[],
	collection: Combination[],
	size: number,
	onProgress: (done: number) => void
): Promise<Blob[]> {
	const serial = serializeLayers(layers);
	const total = collection.length;
	const results = new Array<Blob>(total);
	let next = 0;
	let done = 0;

	return new Promise<Blob[]>((resolve, reject) => {
		const workers: Worker[] = [];
		let settled = false;

		const cleanup = () => {
			for (const w of workers) w.terminate();
		};

		const fail = (err: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(err);
		};

		const dispatch = (worker: Worker) => {
			if (next >= total) return;
			const index = next++;
			worker.postMessage({ type: 'render', index, combo: collection[index], size });
		};

		for (let i = 0; i < poolSize(total); i++) {
			let worker: Worker;
			try {
				worker = new Worker(new URL('../workers/render.worker.ts', import.meta.url), {
					type: 'module'
				});
			} catch (err) {
				fail(err instanceof Error ? err : new Error(String(err)));
				return;
			}

			workers.push(worker);
			worker.postMessage({ type: 'init', layers: serial });

			worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
				const msg = event.data;
				if (msg.type === 'error') {
					fail(new Error(`Render failed at image #${msg.index}: ${msg.message}`));
					return;
				}

				results[msg.index] = msg.blob;
				done++;
				onProgress(done);

				if (done === total) {
					if (!settled) {
						settled = true;
						cleanup();
						resolve(results);
					}
					return;
				}

				dispatch(worker);
			};

			worker.onerror = () => fail(new Error('Render worker crashed'));
			dispatch(worker);
		}
	});
}

async function renderOnMainThread(
	layers: Layer[],
	collection: Combination[],
	size: number,
	onProgress: (done: number) => void
): Promise<Blob[]> {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');

	const bitmaps = new Map<File, ImageBitmap>();
	const results = new Array<Blob>(collection.length);

	try {
		for (let i = 0; i < collection.length; i++) {
			const combo = collection[i];
			ctx.clearRect(0, 0, size, size);
			for (let l = layers.length - 1; l >= 0; l--) {
				const trait = layers[l].traits.find((t) => t.file.name === combo[l]);
				if (!trait) continue;
				let bmp = bitmaps.get(trait.file);
				if (!bmp) {
					bmp = await createImageBitmap(trait.file);
					bitmaps.set(trait.file, bmp);
				}
				ctx.drawImage(bmp, 0, 0, size, size);
			}
			const blob = await new Promise<Blob>((res, rej) =>
				canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob returned null'))), 'image/png')
			);
			results[i] = blob;
			onProgress(i + 1);
		}
	} finally {
		for (const bmp of bitmaps.values()) bmp.close();
	}

	return results;
}
