<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import { debugStore } from '$lib/stores/debug.svelte';
	import type { Layer } from '$lib/types';
	import { Upload, Image as ImageIcon, Film, Loader2, AlertTriangle } from 'lucide-svelte';
	import DebugPanel from './DebugPanel.svelte';
	import Input from './ui/Input.svelte';
	import Textarea from './ui/Textarea.svelte';
	import Card from './ui/Card.svelte';
	import Pill from './ui/Pill.svelte';

	let folderInput = $state<HTMLInputElement | null>(null);
	let isCheckingDimensions = $state(false);

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

	const nameOk = $derived(config.name.trim() !== '');
	const layersOk = $derived(layers.length > 0);
	const sizeOk = $derived(config.size > 0 && config.size <= 10000);
	const preRevealOk = $derived(!config.usePreReveal || config.preRevealImage !== null);
	const dimensionsOk = $derived(layers.length === 0 || dimensionsConsistent);

	function handleFolderChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length === 0) {
			debugStore.log(1, 'folder selection cancelled or empty', 'warn');
			return;
		}

		debugStore.log(1, `received ${files.length} files from folder picker`, 'info');

		const temp: Record<string, File[]> = {};
		let skipped = 0;

		for (const file of files) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rel = (file as any).webkitRelativePath as string;
			const parts = rel.split('/');
			if (parts.length < 3) {
				skipped++;
				continue;
			}
			const layerName = parts[1];
			if (!temp[layerName]) temp[layerName] = [];
			temp[layerName].push(file);
		}

		if (skipped > 0) {
			debugStore.log(1, `skipped ${skipped} files (not inside a layer subfolder)`, 'warn');
		}

		const newLayers: Layer[] = Object.entries(temp).map(([name, layerFiles]) => {
			const evenWeight = layerFiles.length > 0 ? 100 / layerFiles.length : 0;
			return {
				name,
				traits: layerFiles.map((file) => ({ file, weight: evenWeight }))
			};
		});

		generator.setLayers(newLayers);
		debugStore.log(
			1,
			`parsed ${newLayers.length} layers with ${newLayers.reduce((a, l) => a + l.traits.length, 0)} traits`,
			'success'
		);
		loadDimensions(newLayers);
	}

	async function loadDimensions(input: Layer[]) {
		if (input.length === 0) return;
		isCheckingDimensions = true;
		debugStore.log(1, 'checking image dimensions…', 'info');

		try {
			const updated: Layer[] = await Promise.all(
				input.map(async (layer) => ({
					...layer,
					traits: await Promise.all(
						layer.traits.map(async (trait) => {
							if (trait.width !== undefined && trait.height !== undefined) {
								return trait;
							}
							try {
								const bmp = await createImageBitmap(trait.file);
								const w = bmp.width;
								const h = bmp.height;
								bmp.close?.();
								return { ...trait, width: w, height: h };
							} catch {
								debugStore.log(
									1,
									`could not read dimensions for ${trait.file.name}`,
									'warn'
								);
								return trait;
							}
						})
					)
				}))
			);
			generator.setLayers(updated);
			const sizes = [
				...new Set(
					updated
						.flatMap((l) => l.traits)
						.filter((t) => t.width && t.height)
						.map((t) => `${t.width}x${t.height}`)
				)
			];
			if (sizes.length <= 1) {
				debugStore.log(1, `all images share dimensions: ${sizes[0] ?? '∅'}`, 'success');
			} else {
				debugStore.log(
					1,
					`found ${sizes.length} different image sizes: ${sizes.join(', ')}`,
					'error'
				);
			}
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

<div class="animate-in space-y-6">
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
				placeholder="e.g., Cyber Punks 2077"
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
			class="group hover:border-ink flex w-full flex-col items-center justify-center gap-3 rounded border bg-lcd-light px-6 py-10 text-center text-sm text-ink transition-colors
			{layers.length > 0 ? 'border-ink bg-ink/5' : 'border-ink/25'}"
			onclick={() => folderInput?.click()}
		>
			<Upload class="h-9 w-9 {layers.length > 0 ? 'text-ink' : 'text-muted'}" />
			{#if layers.length > 0}
				<span class="font-brains-medium text-xs uppercase tracking-wider text-ink">
					✓ {layers.length} layers · {totalAssets} assets loaded
				</span>
			{:else}
				<span class="font-body text-sm text-muted">
					Click to select your layers folder
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
			Pick a folder containing subfolders (one per layer) of PNG/SVG traits. Top folder name is ignored.
		</p>

		{#if layers.length > 0}
			{#if isCheckingDimensions}
				<div
					class="border-ink/25 bg-lcd-light flex items-center gap-2 rounded border px-3 py-2 text-xs text-muted"
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
						class="font-body w-full rounded border border-border bg-lcd-light px-3 py-2 text-xs text-ink file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1 file:text-on-ink"
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
						class="font-body w-full rounded border border-border bg-lcd-light px-3 py-2 text-xs text-ink file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1 file:text-on-ink"
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

	<DebugPanel
		step={1}
		title="Setup"
		checks={[
			{ label: 'Collection name provided', ok: nameOk, hint: 'fill in a non-empty name' },
			{
				label: 'Collection size in 1–10000',
				ok: sizeOk,
				hint: `current: ${config.size}`
			},
			{
				label: 'Layers folder loaded',
				ok: layersOk,
				hint: 'pick a folder containing layer subfolders'
			},
			{
				label: 'All trait images share dimensions',
				ok: dimensionsOk,
				hint: isCheckingDimensions
					? 'still checking…'
					: `found ${uniqueDimensions.length} different sizes`
			},
			{
				label: 'Pre-reveal image (if enabled)',
				ok: preRevealOk,
				hint: 'pre-reveal is on but no image selected'
			}
		]}
		snapshot={[
			{ label: 'name', value: config.name || '∅' },
			{ label: 'size', value: config.size },
			{ label: 'soulbound', value: String(config.soulbound) },
			{ label: 'usePreReveal', value: String(config.usePreReveal) },
			{ label: 'preRevealImage', value: config.preRevealImage?.name ?? '∅' },
			{ label: 'preRevealAnimation', value: config.preRevealAnimation?.name ?? '∅' },
			{ label: 'layers', value: layers.length },
			{ label: 'total traits', value: totalAssets },
			{ label: 'first layer', value: layers[0]?.name ?? '∅' },
			{ label: 'unique image sizes', value: uniqueDimensions.join(', ') || '∅' },
			{ label: 'dimensions ready', value: String(dimensionsLoaded) }
		]}
	/>
</div>
