<script lang="ts">
	import JSZip from 'jszip';
	import { generator } from '$lib/stores/generator.svelte';
	import { pinFileToIPFS, createIPFSFormData } from '$lib/utils/ipfs';
	import type { Metadata } from '$lib/types';
	import {
		Download,
		Rocket,
		Shield,
		ExternalLink,
		Loader2,
		CheckCircle2
	} from 'lucide-svelte';
	import Card from './ui/Card.svelte';
	import Input from './ui/Input.svelte';
	import Button from './ui/Button.svelte';

	interface Props {
		busy?: boolean;
	}

	let { busy = $bindable(false) }: Props = $props();

	let pinataJwt = $state('');
	let progress = $state(0);
	let status = $state('');
	let isExporting = $state(false);
	let ipfsResult = $state<{ imagesCID: string; metadataCID: string } | null>(null);

	const config = $derived(generator.config);
	const collection = $derived(generator.collection);
	const layers = $derived(generator.layers);

	function syncBusy() {
		busy = isExporting;
	}

	async function generateZip() {
		isExporting = true;
		syncBusy();
		progress = 0;
		status = 'Initializing ZIP generation...';

		try {
			const zip = new JSZip();
			const imagesFolder = zip.folder('images');
			const metadataFolder = zip.folder('metadata');

			const canvas = document.createElement('canvas');
			canvas.width = 1000;
			canvas.height = 1000;

			for (let i = 0; i < collection.length; i++) {
				status = `Rendering image ${i + 1}/${collection.length}`;
				await generator.drawCombo(collection[i], canvas, 1000);
				const blob = await new Promise<Blob>((res) =>
					canvas.toBlob((b) => res(b!), 'image/png')
				);
				imagesFolder?.file(`${i}.png`, blob);
				progress = ((i + 1) / collection.length) * 45;
			}

			for (let i = 0; i < collection.length; i++) {
				status = `Generating metadata ${i + 1}/${collection.length}`;
				const attributes = collection[i].map((trait, idx) => ({
					trait_type: layers[idx].name,
					value: trait.replace(/\.[^/.]+$/, '')
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

			const url = URL.createObjectURL(content);
			const link = document.createElement('a');
			link.href = url;
			link.download = `${config.name.replace(/\s+/g, '-').toLowerCase()}-collection.zip`;
			link.click();
			URL.revokeObjectURL(url);

			progress = 100;
			status = 'ZIP generated and download started!';
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			status = `Error: ${msg}`;
		} finally {
			isExporting = false;
			syncBusy();
		}
	}

	async function uploadToIPFS() {
		if (!pinataJwt) {
			alert('Please enter your Pinata JWT Token');
			return;
		}

		isExporting = true;
		syncBusy();
		progress = 0;
		status = 'Preparing files for IPFS upload...';

		try {
			const canvas = document.createElement('canvas');
			canvas.width = 1000;
			canvas.height = 1000;

			const imageFiles: File[] = [];

			for (let i = 0; i < collection.length; i++) {
				status = `Preparing image ${i + 1}/${collection.length}`;
				await generator.drawCombo(collection[i], canvas, 1000);
				const blob = await new Promise<Blob>((res) =>
					canvas.toBlob((b) => res(b!), 'image/png')
				);
				imageFiles.push(new File([blob], `${i}.png`, { type: 'image/png' }));
				progress = ((i + 1) / collection.length) * 30;
			}

			status = 'Uploading images to IPFS...';
			const imgFormData = createIPFSFormData(imageFiles, 'images', `${config.name} - Images`);
			const imgResult = await pinFileToIPFS(imgFormData, pinataJwt);
			const imagesCID = imgResult.IpfsHash;
			progress = 40;

			const metaFiles: File[] = [];
			for (let i = 0; i < collection.length; i++) {
				const attributes = collection[i].map((trait, idx) => ({
					trait_type: layers[idx].name,
					value: trait.replace(/\.[^/.]+$/, '')
				}));

				const meta: Metadata = {
					name: `${config.name} #${i}`,
					description: config.description,
					image: `ipfs://${imagesCID}/${i}.png`,
					attributes
				};

				if (config.soulbound) {
					meta.soulbound = true;
					meta.attributes.push({ trait_type: 'Soulbound', value: 'Yes' });
				}

				const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
				metaFiles.push(new File([blob], `${i}.json`, { type: 'application/json' }));
			}

			status = 'Uploading metadata to IPFS...';
			const metaFormData = createIPFSFormData(
				metaFiles,
				'metadata',
				`${config.name} - Metadata`
			);
			const metaResult = await pinFileToIPFS(metaFormData, pinataJwt);
			const metadataCID = metaResult.IpfsHash;

			ipfsResult = { imagesCID, metadataCID };
			progress = 100;
			status = 'Collection uploaded to IPFS successfully!';
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			status = `Error: ${msg}`;
		} finally {
			isExporting = false;
			syncBusy();
		}
	}
</script>

<div class="animate-in space-y-6">
	<header class="border-border border-b pb-4">
		<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
			Step 4 · Export
		</p>
		<h2 class="font-array-semi mt-1 text-2xl text-ink">Generate &amp; export</h2>
	</header>

	<div class="grid gap-6 md:grid-cols-2">
		<section class="space-y-4">
			<Card padding="md" variant="panel">
				<p
					class="font-brains-medium mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-ink"
				>
					<Shield class="h-3.5 w-3.5" /> Pinata configuration
				</p>
				<div class="space-y-2">
					<label for="pinataJwt" class="font-brains-medium text-xs uppercase tracking-wider text-muted">
						JWT token
					</label>
					<Input
						id="pinataJwt"
						type="password"
						placeholder="Paste your JWT here..."
						value={pinataJwt}
						oninput={(e) => (pinataJwt = e.currentTarget.value)}
					/>
					<p class="font-body text-xs text-muted">
						Required for IPFS upload. Get it from
						<a
							href="https://pinata.cloud"
							target="_blank"
							rel="noreferrer"
							class="text-ink underline-offset-2 hover:underline">pinata.cloud</a
						>.
					</p>
				</div>
			</Card>

			<div class="space-y-3">
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
				<Button
					variant="outline"
					size="lg"
					onclick={uploadToIPFS}
					disabled={isExporting || !pinataJwt}
					class="w-full"
				>
					{#if isExporting}
						<Loader2 class="h-4 w-4 spin" />
					{:else}
						<Rocket class="h-4 w-4" />
					{/if}
					Upload to IPFS (Pinata)
				</Button>
			</div>
		</section>

		<section class="space-y-4">
			<Card padding="md" variant="panel" class="flex min-h-[300px] flex-col">
				<p
					class="font-brains-medium mb-3 text-[10px] uppercase tracking-widest text-muted"
				>
					Process status
				</p>
				<div
					class="font-mono mb-3 flex-1 space-y-1.5 overflow-y-auto text-[11px] text-ink"
				>
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
				<div class="border-border h-2 overflow-hidden rounded-sm border bg-lcd">
					<div
						class="h-full bg-ink transition-all duration-300"
						style="width: {progress}%"
					></div>
				</div>
				<p class="font-brains-medium mt-1 text-right text-[10px] text-muted">
					{Math.round(progress)}%
				</p>
			</Card>

			{#if ipfsResult}
				<Card
					padding="md"
					class="animate-in border-emerald-600/40 bg-emerald-500/5"
				>
					<p
						class="font-brains-medium mb-3 text-[11px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
					>
						✓ Deployment successful
					</p>
					<div class="space-y-3">
						<div>
							<span class="font-brains-medium block text-[10px] uppercase tracking-wider text-muted">
								Images CID
							</span>
							<code
								class="border-border bg-lcd mt-1 block break-all rounded border px-2 py-1.5 font-mono text-[11px] text-ink"
							>{ipfsResult.imagesCID}</code>
						</div>
						<div>
							<span class="font-brains-medium block text-[10px] uppercase tracking-wider text-muted">
								Metadata CID (base URI)
							</span>
							<code
								class="border-border bg-lcd mt-1 block break-all rounded border px-2 py-1.5 font-mono text-[11px] text-ink"
							>ipfs://{ipfsResult.metadataCID}/</code>
						</div>
						<a
							href={`https://gateway.pinata.cloud/ipfs/${ipfsResult.metadataCID}/0.json`}
							target="_blank"
							rel="noreferrer"
							class="font-brains-medium inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
						>
							<ExternalLink class="h-3 w-3" /> View sample on IPFS gateway
						</a>
					</div>
				</Card>
			{/if}
		</section>
	</div>
</div>
