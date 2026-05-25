<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import { Layers, RefreshCw } from 'lucide-svelte';
	import PreviewItem from './PreviewItem.svelte';
	import Button from './ui/Button.svelte';
	import Pill from './ui/Pill.svelte';
	import type { Combination } from '$lib/types';

	interface Props {
		busy?: boolean;
	}

	let { busy = $bindable(false) }: Props = $props();

	const collection = $derived(generator.collection);
	const size = $derived(generator.config.size);
	const layers = $derived(generator.layers);

	function buildCollection() {
		busy = true;
		const next: Combination[] = [];
		for (let i = 0; i < size; i++) {
			next.push(generator.generateRandomCombo());
		}
		generator.setCollection(next);
		busy = false;
	}

	$effect(() => {
		if (collection.length === 0 && layers.length > 0) {
			buildCollection();
		}
	});
</script>

<section class="animate-in space-y-6 rounded-lg border-2 border-ink bg-surface p-5 md:p-7">
	<header class="border-border flex items-start justify-between gap-3 border-b pb-4">
		<div>
			<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
				Step 3 · Preview
			</p>
			<h2 class="font-array-semi mt-1 text-2xl text-ink">Collection preview</h2>
			<p class="mt-2 max-w-2xl font-body text-xs text-muted">
				Thumbnails render at low resolution for speed. Exports use the resolution you set in step 4.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<Button variant="secondary" size="sm" onclick={buildCollection} disabled={busy}>
				<RefreshCw class="h-3.5 w-3.5 {busy ? 'spin' : ''}" />
				Regenerate
			</Button>
			<Pill tone="ink">
				<Layers class="h-3 w-3" />
				{size} tokens
			</Pill>
		</div>
	</header>

	{#if collection.length === 0}
		<p class="font-body py-12 text-center text-sm italic text-muted">Generating preview…</p>
	{:else}
		<div
			class="grid max-h-[56vh] grid-cols-2 gap-3 overflow-y-auto pr-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
		>
			{#each collection as combo, idx (idx)}
				<PreviewItem {combo} index={idx} />
			{/each}
		</div>
	{/if}
</section>
