<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import { debugStore } from '$lib/stores/debug.svelte';
	import { Layers, RefreshCw } from 'lucide-svelte';
	import DebugPanel from './DebugPanel.svelte';
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

	const uniqueCount = $derived(new Set(collection.map((c) => c.join('|'))).size);
	const duplicateCount = $derived(collection.length - uniqueCount);

	function buildCollection() {
		busy = true;
		const start = performance.now();
		debugStore.log(3, `building collection of size ${size}…`, 'info');
		const next: Combination[] = [];
		for (let i = 0; i < size; i++) {
			next.push(generator.generateRandomCombo());
		}
		generator.setCollection(next);
		const ms = Math.round(performance.now() - start);
		debugStore.log(3, `generated ${next.length} combos in ${ms}ms`, 'success');
		busy = false;
	}

	$effect(() => {
		if (collection.length === 0 && layers.length > 0) {
			buildCollection();
		}
	});
</script>

<div class="animate-in space-y-6">
	<header class="border-border flex items-center justify-between gap-3 border-b pb-4">
		<div>
			<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
				Step 3 · Preview
			</p>
			<h2 class="font-array-semi mt-1 text-2xl text-ink">Collection preview</h2>
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

	<DebugPanel
		step={3}
		title="Preview"
		checks={[
			{ label: 'Collection generated', ok: collection.length > 0 },
			{ label: 'Collection length matches config size', ok: collection.length === size }
		]}
		snapshot={[
			{ label: 'requested size', value: size },
			{ label: 'rendered', value: collection.length },
			{ label: 'unique combos', value: uniqueCount },
			{ label: 'duplicates', value: duplicateCount },
			{ label: 'first combo', value: collection[0]?.join(' / ') ?? '∅' }
		]}
	/>
</div>
