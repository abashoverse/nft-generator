<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import { GripVertical, AlertTriangle, Plus, X, Dice5, Minus } from 'lucide-svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import Select from './ui/Select.svelte';
	import Pill from './ui/Pill.svelte';
	import { tick } from 'svelte';

	let draggedIndex = $state<number | null>(null);
	let traitA = $state('');
	let traitB = $state('');
	let previewCanvas = $state<HTMLCanvasElement | null>(null);

	const layers = $derived(generator.layers);
	const rules = $derived(generator.incompatibleRules);
	const allTraits = $derived(layers.flatMap((l) => l.traits.map((t) => t.file.name)));

	$effect(() => {
		void layers;
		void previewCanvas;
		if (previewCanvas) {
			generator.generatePreview(previewCanvas);
		}
	});

	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDrop(index: number) {
		if (draggedIndex === null) return;
		const from = draggedIndex;
		if (from === index) {
			draggedIndex = null;
			return;
		}
		const next = [...layers];
		const [moved] = next.splice(from, 1);
		next.splice(index, 0, moved);
		generator.setLayers(next);
		draggedIndex = null;
	}

	function handleWeightChange(layerIndex: number, traitIndex: number, weight: number) {
		const clamped = Math.max(0, Math.min(100, weight));
		const next = layers.map((l, i) =>
			i === layerIndex
				? {
						...l,
						traits: l.traits.map((t, j) => (j === traitIndex ? { ...t, weight: clamped } : t))
					}
				: l
		);
		generator.setLayers(next);
	}

	function bumpWeight(layerIndex: number, traitIndex: number, delta: number) {
		const current = layers[layerIndex]?.traits[traitIndex]?.weight ?? 0;
		handleWeightChange(layerIndex, traitIndex, current + delta);
	}

	function normalizeLayer(layerIndex: number) {
		const layer = layers[layerIndex];
		const sum = layer.traits.reduce((a, t) => a + t.weight, 0);
		if (sum <= 0) return;
		const next = layers.map((l, i) =>
			i === layerIndex
				? {
						...l,
						traits: l.traits.map((t) => ({ ...t, weight: (t.weight / sum) * 100 }))
					}
				: l
		);
		generator.setLayers(next);
	}

	function formatPct(n: number) {
		return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '');
	}

	function addRule() {
		if (traitA && traitB && traitA !== traitB) {
			generator.addIncompatibleRule({ traitA, traitB });
			traitA = '';
			traitB = '';
		}
	}

	async function regeneratePreview() {
		await tick();
		if (previewCanvas) {
			await generator.generatePreview(previewCanvas);
		}
	}
</script>

<div class="animate-in space-y-6">
	<header class="border-border flex items-center justify-between border-b pb-4">
		<div>
			<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
				Step 2 · Layers
			</p>
			<h2 class="font-array-semi mt-1 text-2xl text-ink">Layer &amp; rarity config</h2>
		</div>
		<Pill tone="ink">{layers.length} layers</Pill>
	</header>

	<div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
		<section class="space-y-3">
			<p class="font-body text-xs text-muted">
				Drag layers to reorder. Top of the list renders on top. Weights are percentages
				per layer (should sum to 100%), anything down to 0.001%.
			</p>

			{#if layers.length === 0}
				<div
					class="border-ink/25 text-muted font-body rounded border p-8 text-center"
				>
					No layers loaded. Go back to step 1 and select a layers folder.
				</div>
			{:else}
				<div class="space-y-3">
					{#each layers as layer, lIdx (layer.name)}
						{@const layerSum = layer.traits.reduce((a, t) => a + t.weight, 0)}
						{@const sumOk = Math.abs(layerSum - 100) < 0.01}
						<div
							class="border-border bg-lcd rounded border-2 p-4 transition-opacity
							{draggedIndex === lIdx ? 'opacity-50' : 'hover:border-ink'}"
							draggable="true"
							ondragstart={() => handleDragStart(lIdx)}
							ondragover={(e) => e.preventDefault()}
							ondrop={() => handleDrop(lIdx)}
							role="listitem"
						>
							<div class="mb-3 flex items-center gap-2">
								<GripVertical class="h-4 w-4 cursor-grab text-muted" />
								<span class="font-brains-medium text-xs uppercase tracking-wider text-ink">
									{layer.name}
								</span>
								<Pill tone="muted" class="ml-auto">{layer.traits.length} traits</Pill>
							</div>
							<div class="max-h-52 space-y-1.5 overflow-y-auto pr-2">
								{#each layer.traits as trait, tIdx (trait.file.name)}
									{@const actualShare =
										layerSum > 0 ? (trait.weight / layerSum) * 100 : 0}
									{@const diverges =
										layerSum > 0 && Math.abs(actualShare - trait.weight) > 0.01}
									<div
										class="border-border grid grid-cols-[1fr_auto] items-center gap-3 rounded border bg-lcd-light px-3 py-1.5 text-xs"
									>
										<div class="min-w-0">
											<span class="truncate font-body text-ink block" title={trait.file.name}>
												{trait.file.name}
											</span>
											{#if diverges}
												<span
													class="font-brains-medium text-[10px] text-amber-700 dark:text-amber-400"
												>
													actual: {actualShare.toFixed(2)}%
												</span>
											{/if}
										</div>
										<div
											class="border-border bg-lcd inline-flex items-stretch overflow-hidden rounded border focus-within:border-ink"
										>
											<button
												type="button"
												onclick={() => bumpWeight(lIdx, tIdx, -1)}
												disabled={trait.weight <= 0}
												aria-label="Decrease weight by 1%"
												class="hover:bg-ink/5 flex w-6 items-center justify-center text-ink transition-colors disabled:opacity-40"
											>
												<Minus class="h-3 w-3" />
											</button>
											<input
												type="number"
												value={trait.weight}
												min={0}
												max={100}
												step={0.001}
												oninput={(e) =>
													handleWeightChange(
														lIdx,
														tIdx,
														parseFloat(e.currentTarget.value) || 0
													)}
												class="border-x border-ink/10 w-16 bg-transparent px-1 py-0.5 text-right text-xs text-ink focus:outline-none"
											/>
											<span
												class="font-brains-medium border-r border-ink/10 px-1.5 py-0.5 text-[10px] text-muted self-center"
												>%</span
											>
											<button
												type="button"
												onclick={() => bumpWeight(lIdx, tIdx, 1)}
												disabled={trait.weight >= 100}
												aria-label="Increase weight by 1%"
												class="hover:bg-ink/5 flex w-6 items-center justify-center text-ink transition-colors disabled:opacity-40"
											>
												<Plus class="h-3 w-3" />
											</button>
										</div>
									</div>
								{/each}
							</div>
							<div
								class="mt-3 flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[11px]"
							>
								<span class="font-brains-medium uppercase tracking-wider text-muted">
									Sum
								</span>
								<div class="flex items-center gap-2">
									<span
										class="font-brains-medium
										{sumOk
											? 'text-emerald-700 dark:text-emerald-400'
											: 'text-amber-700 dark:text-amber-400'}"
									>
										{formatPct(layerSum)}%
									</span>
									{#if !sumOk}
										<Button
											variant="secondary"
											size="sm"
											onclick={() => normalizeLayer(lIdx)}
										>
											Normalize
										</Button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<aside class="space-y-4 self-start">
			<Card padding="md" variant="panel">
				<p class="font-brains-medium mb-3 text-[10px] uppercase tracking-widest text-muted">
					Live preview
				</p>
				<div class="flex flex-col items-center">
					<canvas
						bind:this={previewCanvas}
						width={300}
						height={300}
						class="border-border bg-lcd rounded border-2"
					></canvas>
					<Button
						variant="secondary"
						size="md"
						class="mt-4"
						onclick={regeneratePreview}
					>
						<Dice5 class="h-4 w-4" /> Generate random
					</Button>
				</div>
			</Card>

			<Card padding="md" class="border-amber-600/40 bg-amber-500/5">
				<p
					class="font-brains-medium mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300"
				>
					<AlertTriangle class="h-3.5 w-3.5" /> Incompatible traits
				</p>
				<div class="mb-3 grid grid-cols-[1fr_1fr_auto] gap-2">
					<Select bind:value={traitA}>
						<option value="">Trait A</option>
						{#each allTraits as t}
							<option value={t}>{t}</option>
						{/each}
					</Select>
					<Select bind:value={traitB}>
						<option value="">Trait B</option>
						{#each allTraits as t}
							<option value={t}>{t}</option>
						{/each}
					</Select>
					<Button variant="primary" size="icon" onclick={addRule} aria-label="Add rule">
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				<div class="space-y-1.5">
					{#if rules.length === 0}
						<p class="font-body text-xs text-muted">No rules added yet.</p>
					{/if}
					{#each rules as rule, idx (idx)}
						<div
							class="flex items-center justify-between gap-2 rounded border border-red-600/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-800 dark:text-red-300"
						>
							<span class="truncate font-body" title="{rule.traitA} ↔ {rule.traitB}">
								{rule.traitA} ↔ {rule.traitB}
							</span>
							<button
								type="button"
								onclick={() => generator.removeIncompatibleRule(idx)}
								aria-label="Remove rule"
								class="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
							>
								<X class="h-3 w-3" />
							</button>
						</div>
					{/each}
				</div>
			</Card>
		</aside>
	</div>
</div>
