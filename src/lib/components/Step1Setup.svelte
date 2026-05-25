<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import type { Layer } from '$lib/types';
	import { Upload, Image as ImageIcon, Film, Loader2, AlertTriangle } from 'lucide-svelte';
	import Input from './ui/Input.svelte';
	import Textarea from './ui/Textarea.svelte';
	import Card from './ui/Card.svelte';
	import Pill from './ui/Pill.svelte';

	let folderInput = $state<HTMLInputElement | null>(null);
	let isCheckingDimensions = $state(false);
	let isDragging = $state(false);

	type FileWithPath = { file: File; relativePath: string };

	const config = $derived(generator.config);
	const layers = $derived(generator.layers);
	const totalAssets = $derived(layers.reduce((acc, l) => acc + l.traits.length, 0));

	const allDimensions = $derived(
		layers
			.flatMap((l) => l.traits)
			.filter((t) => t.width !== undefined && t.height !== undefined)
			.map((t) => `${t.width}x${t.height}`)
	);
	const uniqueDimensions = $derived([...new Set(allDimensions)]);
	const dimensionsLoaded = $derived(
		layers.length > 0 &&
			layers.every((l) => l.traits.every((t) => t.width !== undefined && t.height !== undefined))
	);
	const dimensionsConsistent = $derived(dimensionsLoaded && uniqueDimensions.length <= 1);

	function processFolderFiles(items: FileWithPath[]) {
		const temp: Record<string, File[]> = {};

		for (const { file, relativePath } of items) {
			const parts = relativePath.split('/').filter(Boolean);
			let layerName: string;
			if (parts.length >= 3) {
				layerName = parts[1];
			} else if (parts.length === 2) {
				layerName = parts[0];
			} else {
				continue;
			}
			if (!temp[layerName]) temp[layerName] = [];
			temp[layerName].push(file);
		}

		const newLayers: Layer[] = Object.entries(temp).map(([name, layerFiles]) => {
			const evenWeight = layerFiles.length > 0 ? 100 / layerFiles.length : 0;
			return {
				name,
				traits: layerFiles.map((file) => ({ file, weight: evenWeight }))
			};
		});

		if (newLayers.length === 0) return;
		generator.setLayers(newLayers);
		loadDimensions(newLayers);
	}

	function handleFolderChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length === 0) return;

		const items: FileWithPath[] = files.map((file) => ({
			file,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			relativePath: (file as any).webkitRelativePath as string
		}));

		processFolderFiles(items);
	}

	async function readEntry(
		entry: FileSystemEntry,
		basePath: string
	): Promise<FileWithPath[]> {
		const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
		if (entry.isFile) {
			const file = await new Promise<File>((resolve, reject) => {
				(entry as FileSystemFileEntry).file(resolve, reject);
			});
			return [{ file, relativePath: fullPath }];
		}
		if (entry.isDirectory) {
			const reader = (entry as FileSystemDirectoryEntry).createReader();
			const collected: FileSystemEntry[] = [];
			const readBatch = (): Promise<void> =>
				new Promise((resolve) =>
					reader.readEntries((batch) => {
						if (batch.length === 0) resolve();
						else {
							collected.push(...batch);
							readBatch().then(resolve);
						}
					})
				);
			await readBatch();
			const nested = await Promise.all(collected.map((child) => readEntry(child, fullPath)));
			return nested.flat();
		}
		return [];
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const items = e.dataTransfer?.items;
		if (!items || items.length === 0) return;

		const entries: FileSystemEntry[] = [];
		for (let i = 0; i < items.length; i++) {
			const entry = items[i].webkitGetAsEntry();
			if (entry) entries.push(entry);
		}

		if (entries.length === 0) return;

		const dropped = (await Promise.all(entries.map((entry) => readEntry(entry, '')))).flat();
		if (dropped.length === 0) return;

		processFolderFiles(dropped);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		if (e.currentTarget === e.target) isDragging = false;
	}

	function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
		return new Promise((resolve) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			const timer = setTimeout(() => {
				img.src = '';
				URL.revokeObjectURL(url);
				console.warn(`[Step1Setup] timed out reading dimensions for ${file.name}`);
				resolve(null);
			}, 5000);
			img.onload = () => {
				clearTimeout(timer);
				const w = img.naturalWidth;
				const h = img.naturalHeight;
				URL.revokeObjectURL(url);
				resolve(w > 0 && h > 0 ? { width: w, height: h } : null);
			};
			img.onerror = () => {
				clearTimeout(timer);
				URL.revokeObjectURL(url);
				console.warn(`[Step1Setup] could not read dimensions for ${file.name}`);
				resolve(null);
			};
			img.src = url;
		});
	}

	async function loadDimensions(input: Layer[]) {
		if (input.length === 0) return;
		isCheckingDimensions = true;

		try {
			const updated: Layer[] = await Promise.all(
				input.map(async (layer) => ({
					...layer,
					traits: await Promise.all(
						layer.traits.map(async (trait) => {
							if (trait.width !== undefined && trait.height !== undefined) {
								return trait;
							}
							const size = await readImageSize(trait.file);
							return size
								? { ...trait, width: size.width, height: size.height }
								: { ...trait, width: 0, height: 0 };
						})
					)
				}))
			);
			generator.setLayers(updated);
		} finally {
			isCheckingDimensions = false;
		}
	}

	function handlePreRevealImage(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		generator.updateConfig({ preRevealImage: file });
	}

	function handlePreRevealAnimation(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		generator.updateConfig({ preRevealAnimation: file });
	}
</script>

<section class="animate-in space-y-6 rounded-lg border-2 border-ink bg-surface p-5 md:p-7">
	<header class="border-border flex items-center justify-between border-b pb-4">
		<div>
			<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
				Step 1 · Setup
			</p>
			<h2 class="font-array-semi mt-1 text-2xl text-ink">Collection Setup</h2>
		</div>
		<Pill tone="outline">Define metadata + assets</Pill>
	</header>

	<div class="grid gap-4 md:grid-cols-2">
		<div class="space-y-2">
			<label for="collectionName" class="font-brains-medium text-xs uppercase tracking-wider text-muted">
				Collection name
			</label>
			<Input
				id="collectionName"
				type="text"
				placeholder="e.g., abashoBots"
				value={config.name}
				oninput={(e) => generator.updateConfig({ name: e.currentTarget.value })}
			/>
		</div>

		<div class="space-y-2">
			<label for="collectionSize" class="font-brains-medium text-xs uppercase tracking-wider text-muted">
				Collection size
			</label>
			<Input
				id="collectionSize"
				type="number"
				min={1}
				max={10000}
				value={config.size}
				oninput={(e) =>
					generator.updateConfig({ size: parseInt(e.currentTarget.value) || 0 })}
			/>
		</div>
	</div>

	<div class="space-y-2">
		<label for="collectionDesc" class="font-brains-medium text-xs uppercase tracking-wider text-muted">
			Description
		</label>
		<Textarea
			id="collectionDesc"
			placeholder="Describe your unique collection..."
			value={config.description}
			oninput={(e) =>
				generator.updateConfig({ description: e.currentTarget.value })}
		/>
	</div>

	<div class="space-y-2">
		<span class="font-brains-medium block text-xs uppercase tracking-wider text-muted">
			Layers folder
		</span>
		<button
			type="button"
			class="group hover:border-ink flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 bg-surface px-6 py-10 text-center text-sm text-ink transition-colors duration-200 ease-out
			{isDragging
				? 'border-ink bg-ink/[0.12]'
				: layers.length > 0
					? 'border-ink bg-ink/[0.08]'
					: 'border-ink/30'}"
			onclick={() => folderInput?.click()}
			ondragover={handleDragOver}
			ondragenter={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			<Upload
				class="h-9 w-9 {isDragging || layers.length > 0 ? 'text-ink' : 'text-muted'}"
			/>
			{#if isDragging}
				<span class="font-brains-medium text-xs uppercase tracking-wider text-ink">
					Drop to load layers
				</span>
			{:else if layers.length > 0}
				<span class="font-brains-medium text-xs uppercase tracking-wider text-ink">
					✓ {layers.length} layers · {totalAssets} assets loaded
				</span>
			{:else}
				<span class="font-body text-sm text-muted">
					Drop your layers folder here, or click to browse
				</span>
			{/if}
			<input
				bind:this={folderInput}
				type="file"
				class="sr-only"
				multiple
				webkitdirectory
				onchange={handleFolderChange}
			/>
		</button>
		<p class="font-body text-xs text-muted">
			Folder structure: one subfolder per layer, each containing PNG/SVG traits. Dropping the folder avoids the browser's batch-upload prompt; clicking triggers it.
		</p>

		{#if layers.length > 0}
			{#if isCheckingDimensions}
				<div
					class="border-ink/30 bg-surface flex items-center gap-2 rounded-md border-2 px-3 py-2 text-xs text-muted"
				>
					<Loader2 class="h-3.5 w-3.5 spin" /> Checking image dimensions…
				</div>
			{:else if dimensionsLoaded && !dimensionsConsistent}
				<div
					class="rounded border border-red-600/40 bg-red-500/5 px-3 py-3 text-xs"
				>
					<p
						class="font-brains-medium mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-red-700 dark:text-red-400"
					>
						<AlertTriangle class="h-3.5 w-3.5" /> Mismatched image sizes
					</p>
					<p class="font-body mb-2 text-ink">
						All trait images must share the same dimensions or layers won't overlap correctly. Found {uniqueDimensions.length}
						different sizes:
					</p>
					<ul class="space-y-1">
						{#each layers as l}
							{@const layerSizes = [
								...new Set(
									l.traits
										.filter((t) => t.width && t.height)
										.map((t) => `${t.width}×${t.height}`)
								)
							]}
							<li class="font-mono text-[11px] text-ink">
								<span class="text-muted">{l.name}:</span>
								<span
									class="ml-1
									{layerSizes.length > 1 ? 'text-red-700 dark:text-red-400' : 'text-ink'}"
								>
									{layerSizes.join(', ') || '?'}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{:else if dimensionsLoaded && uniqueDimensions.length === 1}
				<p
					class="font-brains-medium text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
				>
					✓ All traits are {uniqueDimensions[0].replace('x', '×')}
				</p>
			{/if}
		{/if}
	</div>

	<Card padding="md" variant="panel">
		<label class="flex cursor-pointer items-start gap-3">
			<input
				type="checkbox"
				class="mt-0.5 h-4 w-4 accent-ink"
				checked={config.usePreReveal}
				onchange={(e) => generator.updateConfig({ usePreReveal: e.currentTarget.checked })}
			/>
			<div class="flex-1">
				<span class="font-body text-sm font-medium text-ink">Use pre-reveal (placeholder)</span>
				<p class="font-body text-xs text-muted">Hidden image shown before reveal.</p>
			</div>
		</label>

		{#if config.usePreReveal}
			<div class="animate-in mt-4 grid gap-3 sm:grid-cols-2">
				<div class="space-y-2">
					<label
						for="prereveal-image"
						class="font-brains-medium flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted"
					>
						<ImageIcon class="h-3.5 w-3.5" /> Image (required)
					</label>
					<input
						id="prereveal-image"
						type="file"
						accept="image/*"
						onchange={handlePreRevealImage}
						class="font-body w-full rounded-md border-2 border-ink bg-surface px-3 py-2 text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1 file:text-on-ink"
					/>
					{#if config.preRevealImage}
						<p class="font-brains-medium text-[11px] text-emerald-700 dark:text-emerald-400">
							✓ {config.preRevealImage.name}
						</p>
					{/if}
				</div>
				<div class="space-y-2">
					<label
						for="prereveal-anim"
						class="font-brains-medium flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted"
					>
						<Film class="h-3.5 w-3.5" /> Animation (optional)
					</label>
					<input
						id="prereveal-anim"
						type="file"
						accept="video/*,image/gif"
						onchange={handlePreRevealAnimation}
						class="font-body w-full rounded-md border-2 border-ink bg-surface px-3 py-2 text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1 file:text-on-ink"
					/>
					{#if config.preRevealAnimation}
						<p class="font-brains-medium text-[11px] text-emerald-700 dark:text-emerald-400">
							✓ {config.preRevealAnimation.name}
						</p>
					{/if}
				</div>
			</div>
		{/if}
	</Card>

	<Card padding="md" variant="panel">
		<label class="flex cursor-pointer items-start gap-3">
			<input
				type="checkbox"
				class="mt-0.5 h-4 w-4 accent-ink"
				checked={config.soulbound}
				onchange={(e) => generator.updateConfig({ soulbound: e.currentTarget.checked })}
			/>
			<div class="flex-1">
				<span class="font-body text-sm font-medium text-ink">Soulbound collection</span>
				<p class="font-body text-xs text-muted">
					Marks tokens as non-transferable in metadata.
				</p>
			</div>
		</label>
	</Card>
</section>
