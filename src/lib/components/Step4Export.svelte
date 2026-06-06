<script lang="ts">
	import JSZip from 'jszip';
	import { generator } from '$lib/stores/generator.svelte';
	import { renderCollectionToBlobs } from '$lib/render/exportRenderer';
	import { paywall, FREE_TIER_EXPORT_PX } from '$lib/paywall.svelte';
	import type { Metadata } from '$lib/types';
	import { Download, Loader2, CheckCircle2, Lock } from 'lucide-svelte';
	import Card from './ui/Card.svelte';
	import Input from './ui/Input.svelte';
	import Button from './ui/Button.svelte';
	import Pill from './ui/Pill.svelte';
	import PaywallModal from './PaywallModal.svelte';

	interface Props {
		busy?: boolean;
	}

	let { busy = $bindable(false) }: Props = $props();

	let progress = $state(0);
	let status = $state('');
	let isExporting = $state(false);
	let showPaywall = $state(false);
	let readyBlob = $state<Blob | null>(null);
	let readyName = $state('');
	let readySize = $state(0);

	const config = $derived(generator.config);
	const collection = $derived(generator.collection);
	const layers = $derived(generator.layers);
	const exportSize = $derived(
		paywall.unlocked
			? Math.max(1, Math.min(8192, config.exportSize || 1000))
			: FREE_TIER_EXPORT_PX
	);

	const sourceHint = $derived.by(() => {
		const ts = layers.flatMap((l) => l.traits).filter((t) => t.width && t.height);
		if (ts.length === 0) return null;
		const sizes = new Set(ts.map((t) => `${t.width}×${t.height}`));
		if (sizes.size === 1) return [...sizes][0];
		return `${sizes.size} mixed sizes`;
	});

	const sourceSquare = $derived.by(() => {
		const ts = layers.flatMap((l) => l.traits).filter((t) => t.width && t.height);
		if (ts.length === 0) return null;
		const sizes = new Set(ts.map((t) => `${t.width}×${t.height}`));
		if (sizes.size !== 1) return null;
		const t = ts[0];
		return t.width === t.height ? t.width! : null;
	});

	function syncBusy() {
		busy = isExporting;
	}

	function triggerDownload(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		// Some browsers (older Firefox) only honour a click on an in-DOM anchor.
		document.body.appendChild(link);
		link.click();
		link.remove();
		// Revoking synchronously can cancel the download before it starts.
		setTimeout(() => URL.revokeObjectURL(url), 10000);
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function generateZip() {
		isExporting = true;
		syncBusy();
		progress = 0;
		readyBlob = null;
		status = 'Initializing ZIP generation...';

		try {
			const zip = new JSZip();
			const imagesFolder = zip.folder('images');
			const metadataFolder = zip.folder('metadata');

			const total = collection.length;
			const blobs = await renderCollectionToBlobs(
				layers,
				collection,
				exportSize,
				(rendered) => {
					status = `Rendering image ${rendered}/${total}`;
					progress = (rendered / total) * 45;
				}
			);
			for (let i = 0; i < blobs.length; i++) {
				imagesFolder?.file(`${i}.png`, blobs[i]);
			}

			for (let i = 0; i < collection.length; i++) {
				status = `Generating metadata ${i + 1}/${collection.length}`;
				const attributes = collection[i].map((traitId, idx) => ({
					trait_type: layers[idx].name,
					value: layers[idx].traits.find((t) => t.id === traitId)?.name ?? ''
				}));

				const meta: Metadata = {
					name: `${config.name} #${i}`,
					description: config.description,
					image: `${i}.png`,
					attributes
				};

				if (config.soulbound) {
					meta.soulbound = true;
					meta.attributes.push({ trait_type: 'Soulbound', value: 'Yes' });
				}

				metadataFolder?.file(`${i}.json`, JSON.stringify(meta, null, 2));
				progress = 45 + ((i + 1) / collection.length) * 45;
			}

			status = 'Compressing ZIP file...';
			const content = await zip.generateAsync({ type: 'blob' });

			const filename = `${config.name.replace(/\s+/g, '-').toLowerCase()}-collection.zip`;
			readyBlob = content;
			readyName = filename;
			readySize = content.size;

			// Best-effort automatic download. Browsers that block it (lost user
			// activation after a long async job, iOS Safari, etc.) still have the
			// Download button below, which fires inside a fresh user gesture.
			triggerDownload(content, filename);

			progress = 100;
			status = 'ZIP ready. If the download did not start, use the button below.';
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			status = `Error: ${msg}`;
		} finally {
			isExporting = false;
			syncBusy();
		}
	}
</script>

<section class="animate-in space-y-6 rounded-lg border-2 border-ink bg-surface p-5 md:p-7">
	<header class="border-border border-b pb-4">
		<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
			Step 4 · Export
		</p>
		<h2 class="font-array-semi mt-1 text-2xl text-ink">Generate &amp; export</h2>
	</header>

	<div class="grid gap-6 md:grid-cols-2">
		<section class="space-y-4">
			<Card padding="md" variant="panel">
				<div class="mb-3 flex items-center gap-2">
					<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
						Export resolution
					</p>
					{#if !paywall.unlocked}
						<Pill tone="muted">
							<Lock class="h-2.5 w-2.5" /> Free tier
						</Pill>
					{/if}
				</div>
				{#if paywall.unlocked}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<Input
								id="exportSize"
								type="number"
								min={1}
								max={8192}
								value={config.exportSize}
								oninput={(e) =>
									generator.updateConfig({
										exportSize: parseInt(e.currentTarget.value) || 1000
									})}
								class="w-32"
							/>
							<span class="font-mono text-xs text-muted">px²</span>
							{#if sourceSquare && sourceSquare !== config.exportSize}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => generator.updateConfig({ exportSize: sourceSquare! })}
								>
									Match source
								</Button>
							{/if}
						</div>
						{#if sourceHint}
							<p class="font-body text-xs text-muted">
								Source: {sourceHint}. Match it for lossless output, go higher to upscale, lower to
								downscale.
							</p>
						{/if}
					</div>
				{:else}
					<div class="space-y-3">
						<div class="flex items-baseline gap-2">
							<span class="font-mono text-2xl text-ink">{FREE_TIER_EXPORT_PX}</span>
							<span class="font-mono text-xs text-muted">px²</span>
						</div>
						<p class="font-body text-xs text-muted">
							Free tier caps exports at {FREE_TIER_EXPORT_PX}×{FREE_TIER_EXPORT_PX}. Unlock custom
							resolutions by holding an abasho/abashos NFT, paying once, or self-hosting.
						</p>
						<Button
							variant="primary"
							size="sm"
							class="w-full"
							onclick={() => (showPaywall = true)}
						>
							Unlock custom resolution
						</Button>
					</div>
				{/if}
			</Card>

			<Button
				variant="primary"
				size="lg"
				onclick={generateZip}
				disabled={isExporting}
				class="w-full"
			>
				{#if isExporting}
					<Loader2 class="h-4 w-4 spin" />
				{:else}
					<Download class="h-4 w-4" />
				{/if}
				Generate &amp; download ZIP
			</Button>

			{#if readyBlob}
				<Button
					variant="secondary"
					size="lg"
					onclick={() => readyBlob && triggerDownload(readyBlob, readyName)}
					class="w-full"
				>
					<Download class="h-4 w-4" />
					Download ZIP ({formatBytes(readySize)})
				</Button>
			{/if}
		</section>

		<section class="space-y-4">
			<Card padding="md" variant="panel" class="flex min-h-[300px] flex-col">
				<p class="font-brains-medium mb-3 text-[10px] uppercase tracking-widest text-muted">
					Process status
				</p>
				<div class="font-mono mb-3 flex-1 space-y-1.5 overflow-y-auto text-[11px] text-ink">
					<p class="text-muted">$ initialising_engine...</p>
					{#if status}
						<p class="text-ink">&gt; {status}</p>
					{/if}
					{#if progress === 100}
						<div class="mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
							<CheckCircle2 class="h-4 w-4" />
							OPERATION COMPLETE
						</div>
					{/if}
				</div>
				<div class="border-ink h-2 overflow-hidden rounded-sm border-2 bg-surface">
					<div
						class="h-full bg-ink transition-all duration-300"
						style="width: {progress}%"
					></div>
				</div>
				<p class="font-brains-medium mt-1 text-right text-[10px] text-muted">
					{Math.round(progress)}%
				</p>
			</Card>
		</section>
	</div>

	<PaywallModal open={showPaywall} onClose={() => (showPaywall = false)} />
</section>
