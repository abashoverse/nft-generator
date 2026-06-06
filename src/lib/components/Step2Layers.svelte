<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import type { IncompatibleRule, Trait } from '$lib/types';
	import {
		GripVertical,
		AlertTriangle,
		X,
		Minus,
		Plus,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		ArrowUp,
		ArrowDown
	} from 'lucide-svelte';
	import Button from './ui/Button.svelte';
	import Select from './ui/Select.svelte';
	import Pill from './ui/Pill.svelte';
	import { tick } from 'svelte';

	let draggedIndex = $state<number | null>(null);
	let previewCanvas = $state<HTMLCanvasElement | null>(null);
	let showIncompatibility = $state(false);

	let draftConditions = $state<{ layerId: string; traitIds: string[] }[]>([]);
	let draftBlockLayerId = $state('');
	let draftBlockTraitId = $state('');
	let builderStep = $state<1 | 2>(1);

	const layers = $derived(generator.layers);
	const rules = $derived(generator.incompatibleRules);

	const usedConditionLayers = $derived(new Set(draftConditions.map((c) => c.layerId)));
	const availableForBlock = $derived(layers.filter((l) => !usedConditionLayers.has(l.id)));

	const ifValid = $derived(
		draftConditions.length >= 1 && draftConditions.every((c) => c.traitIds.length > 0)
	);

	const draftValid = $derived(
		ifValid &&
			draftBlockLayerId !== '' &&
			draftBlockTraitId !== '' &&
			!usedConditionLayers.has(draftBlockLayerId)
	);

	$effect(() => {
		void layers;
		void previewCanvas;
		if (previewCanvas) {
			generator.generatePreview(previewCanvas);
		}
	});

	$effect(() => {
		if (draftBlockLayerId && usedConditionLayers.has(draftBlockLayerId)) {
			draftBlockLayerId = '';
		}
		if (
			draftBlockTraitId &&
			!traitsOfLayer(draftBlockLayerId).some((t) => t.id === draftBlockTraitId)
		) {
			draftBlockTraitId = '';
		}
	});

	function round3(n: number) {
		return Math.round(n * 1000) / 1000;
	}

	// Live reorder: the dragged layer slots into place as the pointer moves over
	// targets, so you preview the result mid-drag instead of only on drop. The
	// grip is the drag source; the whole card is the drop target.
	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		const card = (e.currentTarget as HTMLElement).closest(
			'[data-layer-card]'
		) as HTMLElement | null;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
			if (card) e.dataTransfer.setDragImage(card, 24, 24);
		}
	}

	function handleDragEnter(index: number) {
		if (draggedIndex === null || draggedIndex === index) return;
		generator.moveLayer(draggedIndex, index);
		draggedIndex = index;
	}

	function handleDragEnd() {
		draggedIndex = null;
	}

	function handleWeightChange(layerId: string, traitId: string, weight: number) {
		const clamped = round3(Math.max(0, Math.min(100, weight)));
		generator.setLayers(
			layers.map((l) =>
				l.id === layerId
					? {
							...l,
							traits: l.traits.map((t) => (t.id === traitId ? { ...t, weight: clamped } : t))
						}
					: l
			)
		);
	}

	function bumpWeight(layerId: string, traitId: string, current: number, delta: number) {
		handleWeightChange(layerId, traitId, current + delta);
	}

	function normalizeLayer(layerId: string) {
		const layer = layerById(layerId);
		if (!layer) return;
		const sum = layer.traits.reduce((a, t) => a + t.weight, 0);
		if (sum <= 0) return;
		generator.setLayers(
			layers.map((l) =>
				l.id === layerId
					? { ...l, traits: l.traits.map((t) => ({ ...t, weight: round3((t.weight / sum) * 100) })) }
					: l
			)
		);
	}

	function formatPct(n: number) {
		return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '');
	}

	async function regeneratePreview() {
		await tick();
		if (previewCanvas) {
			await generator.generatePreview(previewCanvas);
		}
	}

	function layerById(id: string) {
		return layers.find((l) => l.id === id);
	}

	function layerLabel(id: string): string {
		return layerById(id)?.name ?? '(removed)';
	}

	function traitsOfLayer(layerId: string) {
		return layerById(layerId)?.traits ?? [];
	}

	function traitLabel(layerId: string, traitId: string): string {
		return traitsOfLayer(layerId).find((t) => t.id === traitId)?.name ?? '(removed)';
	}

	function addConditionLayer() {
		const next = layers.find((l) => !usedConditionLayers.has(l.id));
		if (!next) return;
		draftConditions = [...draftConditions, { layerId: next.id, traitIds: [] }];
	}

	function removeCondition(idx: number) {
		draftConditions = draftConditions.filter((_, i) => i !== idx);
	}

	function setConditionLayer(idx: number, newLayerId: string) {
		draftConditions = draftConditions.map((c, i) =>
			i === idx ? { layerId: newLayerId, traitIds: [] } : c
		);
	}

	function toggleConditionTrait(idx: number, traitId: string) {
		draftConditions = draftConditions.map((c, i) => {
			if (i !== idx) return c;
			const has = c.traitIds.includes(traitId);
			return {
				...c,
				traitIds: has ? c.traitIds.filter((t) => t !== traitId) : [...c.traitIds, traitId]
			};
		});
	}

	function saveRule() {
		if (!draftValid) return;
		generator.addIncompatibleRule({
			conditions: draftConditions.map((c) => ({ layerId: c.layerId, traitIds: [...c.traitIds] })),
			blockedLayerId: draftBlockLayerId,
			blockedTraitId: draftBlockTraitId
		});
		draftConditions = [];
		draftBlockLayerId = '';
		draftBlockTraitId = '';
		builderStep = 1;
	}

	function describeIf(conditions: { layerId: string; traitIds: string[] }[]): string {
		return conditions
			.map((c) => {
				const traits = c.traitIds.map((tid) => traitLabel(c.layerId, tid)).join(' or ');
				const wrap = c.traitIds.length > 1 ? `(${traits})` : traits;
				return `${layerLabel(c.layerId)} = ${wrap}`;
			})
			.join(' AND ');
	}

	function clearAllRules() {
		for (let i = rules.length - 1; i >= 0; i--) {
			generator.removeIncompatibleRule(i);
		}
	}

	function describeRule(rule: IncompatibleRule): string {
		return `If ${describeIf(rule.conditions)} then block ${layerLabel(rule.blockedLayerId)} = ${traitLabel(rule.blockedLayerId, rule.blockedTraitId)}`;
	}
</script>

{#snippet weightStepper(layerId: string, trait: Trait)}
	<div
		class="border-ink/30 bg-surface inline-flex items-stretch overflow-hidden rounded-md border-2 focus-within:border-ink"
	>
		<button
			type="button"
			onclick={() => bumpWeight(layerId, trait.id, trait.weight, -1)}
			disabled={trait.weight <= 0}
			aria-label="Decrease weight by 1%"
			class="hover:bg-ink/5 flex w-6 items-center justify-center text-ink transition-colors disabled:opacity-40"
		>
			<Minus class="h-3 w-3" />
		</button>
		<input
			type="number"
			value={round3(trait.weight)}
			min={0}
			max={100}
			step={0.001}
			oninput={(e) => handleWeightChange(layerId, trait.id, parseFloat(e.currentTarget.value) || 0)}
			class="w-16 border-x border-ink/10 bg-transparent px-1 py-0.5 text-right text-xs text-ink focus:outline-none"
		/>
		<span
			class="font-brains-medium self-center border-r border-ink/10 px-1.5 py-0.5 text-[10px] text-muted"
			>%</span
		>
		<button
			type="button"
			onclick={() => bumpWeight(layerId, trait.id, trait.weight, 1)}
			disabled={trait.weight >= 100}
			aria-label="Increase weight by 1%"
			class="hover:bg-ink/5 flex w-6 items-center justify-center text-ink transition-colors disabled:opacity-40"
		>
			<Plus class="h-3 w-3" />
		</button>
	</div>
{/snippet}

<section class="animate-in space-y-6 rounded-lg border-2 border-ink bg-surface p-5 md:p-7">
	<header class="border-border flex items-start justify-between gap-4 border-b pb-4">
		<div>
			<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
				Step 2 · Layers
			</p>
			<h2 class="font-array-semi mt-1 text-2xl text-ink">Layer &amp; rarity config</h2>
			<p class="mt-2 max-w-2xl font-body text-xs text-muted">
				Reorder with the up/down arrows on the left, or drag the handle on the right (the layer
				slots into place as you drag). Top of the list renders on top. Click a layer or trait name
				to rename it. Toggle <span class="font-brains-medium">None</span> to add a trait that renders
				nothing. Weights are percentages per layer (should sum to 100%), down to 0.001%.
			</p>
		</div>
		<Pill tone="ink">{layers.length} layers</Pill>
	</header>

	<div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
		<section class="space-y-3">
			{#if layers.length === 0}
				<div class="border-ink/25 text-muted font-body rounded border p-8 text-center">
					No layers loaded. Go back to step 1 and select a layers folder.
				</div>
			{:else}
				<div class="space-y-3">
					{#each layers as layer, lIdx (layer.id)}
						{@const noneTrait = layer.traits.find((t) => !t.file)}
						{@const realTraits = layer.traits.filter((t) => t.file)}
						{@const layerSum = layer.traits.reduce((a, t) => a + t.weight, 0)}
						{@const sumOk = Math.abs(layerSum - 100) < 0.01}
						<div
							data-layer-card
							class="border-ink bg-surface rounded-lg border-2 p-4 transition-opacity
							{draggedIndex === lIdx ? 'opacity-40' : 'hover:bg-ink/[0.06]'}"
							ondragover={(e) => e.preventDefault()}
							ondragenter={() => handleDragEnter(lIdx)}
							ondrop={(e) => {
								e.preventDefault();
								handleDragEnd();
							}}
							role="listitem"
						>
							<div class="mb-3 flex items-center gap-2">
								<div class="flex flex-col">
									<button
										type="button"
										onclick={() => generator.moveLayer(lIdx, lIdx - 1)}
										disabled={lIdx === 0}
										aria-label="Move layer up"
										class="hover:bg-ink/10 flex h-4 w-5 items-center justify-center rounded-sm text-muted transition-colors disabled:opacity-30"
									>
										<ArrowUp class="h-3 w-3" />
									</button>
									<button
										type="button"
										onclick={() => generator.moveLayer(lIdx, lIdx + 1)}
										disabled={lIdx === layers.length - 1}
										aria-label="Move layer down"
										class="hover:bg-ink/10 flex h-4 w-5 items-center justify-center rounded-sm text-muted transition-colors disabled:opacity-30"
									>
										<ArrowDown class="h-3 w-3" />
									</button>
								</div>
								<input
									value={layer.name}
									oninput={(e) => generator.renameLayer(layer.id, e.currentTarget.value)}
									aria-label="Layer name"
									class="font-brains-medium min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-xs uppercase tracking-wider text-ink hover:border-ink/20 focus:border-ink focus:outline-none"
								/>
								<Pill tone="muted">{layer.traits.length} traits</Pill>
								<button
									type="button"
									draggable="true"
									ondragstart={(e) => handleDragStart(e, lIdx)}
									ondragend={handleDragEnd}
									aria-label="Drag to reorder layer"
									title="Drag to reorder"
									class="shrink-0 cursor-grab text-muted transition-colors hover:text-ink active:cursor-grabbing"
								>
									<GripVertical class="h-4 w-4" />
								</button>
							</div>
							<div class="max-h-52 space-y-1.5 overflow-y-auto pr-2">
								<div
									class="border-ink/15 bg-surface grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3 py-1.5 text-xs"
								>
									<div class="flex min-w-0 items-center gap-2">
										<button
											type="button"
											role="switch"
											aria-checked={!!noneTrait}
											aria-label="Toggle None trait"
											onclick={() => generator.setLayerAllowNone(layer.id, !noneTrait)}
											class="relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border-2 border-ink transition-colors {noneTrait
												? 'bg-ink'
												: 'bg-transparent'}"
										>
											<span
												class="inline-block h-2 w-2 rounded-full transition-transform {noneTrait
													? 'translate-x-3.5 bg-on-ink'
													: 'translate-x-0.5 bg-ink'}"
											></span>
										</button>
										{#if noneTrait}
											<input
												value={noneTrait.name}
												oninput={(e) =>
													generator.renameTrait(layer.id, noneTrait.id, e.currentTarget.value)}
												aria-label="None trait name"
												title="Renders nothing"
												class="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 font-body text-ink hover:border-ink/20 focus:border-ink focus:outline-none"
											/>
										{:else}
											<span class="font-body text-ink">None</span>
										{/if}
										<span class="font-brains-medium shrink-0 text-[10px] text-muted">
											renders nothing
										</span>
									</div>
									{#if noneTrait}
										{@render weightStepper(layer.id, noneTrait)}
									{/if}
								</div>

								{#each realTraits as trait (trait.id)}
									{@const actualShare = layerSum > 0 ? (trait.weight / layerSum) * 100 : 0}
									{@const diverges = layerSum > 0 && Math.abs(actualShare - trait.weight) > 0.01}
									<div
										class="border-ink/15 bg-surface grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3 py-1.5 text-xs"
									>
										<div class="min-w-0">
											<input
												value={trait.name}
												oninput={(e) =>
													generator.renameTrait(layer.id, trait.id, e.currentTarget.value)}
												aria-label="Trait name"
												title={trait.file ? trait.file.name : 'Renders nothing'}
												class="block w-full truncate rounded-sm border border-transparent bg-transparent px-1 py-0.5 font-body text-ink hover:border-ink/20 focus:border-ink focus:outline-none"
											/>
											{#if diverges}
												<span
													class="font-brains-medium px-1 text-[10px] text-amber-700 dark:text-amber-400"
												>
													actual: {actualShare.toFixed(2)}%
												</span>
											{/if}
										</div>
										{@render weightStepper(layer.id, trait)}
									</div>
								{/each}
							</div>
							<div
								class="mt-3 flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[11px]"
							>
								<span class="font-brains-medium uppercase tracking-wider text-muted"> Sum </span>
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
										<Button variant="secondary" size="sm" onclick={() => normalizeLayer(layer.id)}>
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

		<aside class="flex flex-col gap-3 self-start">
			<canvas
				bind:this={previewCanvas}
				width={512}
				height={512}
				class="border-ink bg-surface aspect-square w-full rounded-md border-2"
			></canvas>
			<Button variant="secondary" size="md" class="w-full" onclick={regeneratePreview}>
				Generate Random
			</Button>
			<p class="text-center font-body text-[10px] leading-snug text-muted">
				Previews render at low resolution for speed. Exports use the resolution you set in step 4.
			</p>
		</aside>
	</div>
</section>

{#if layers.length >= 2}
	<section class="animate-in rounded-lg border-2 border-ink bg-surface p-5 md:p-7">
		<button
			type="button"
			onclick={() => (showIncompatibility = !showIncompatibility)}
			aria-expanded={showIncompatibility}
			class="group flex w-full items-center gap-3 text-left"
		>
			<AlertTriangle class="h-4 w-4 text-amber-700 dark:text-amber-300" />
			<h3 class="font-display text-base font-semibold tracking-tight text-ink">
				Incompatible traits
			</h3>
			<Pill tone="muted" class="ml-auto">
				{rules.length}
				{rules.length === 1 ? 'rule' : 'rules'}
			</Pill>
			<ChevronDown
				class="h-4 w-4 text-muted transition-transform duration-200 ease-out {showIncompatibility
					? 'rotate-180'
					: ''}"
			/>
		</button>

		{#if showIncompatibility}
			<div class="mt-4 space-y-5 border-t border-ink/10 pt-4">
				<p class="max-w-2xl font-body text-xs text-muted">
					Build a rule: pick one or more layer conditions (checking multiple traits in a layer
					means OR, any one of them triggers the rule). When all conditions match, the chosen trait
					gets blocked. The blocked trait must come from a layer not used in the conditions.
				</p>

				{#if rules.length > 0}
					<div class="space-y-2">
						<div class="flex items-center gap-3">
							<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
								Active rules ({rules.length})
							</p>
							<Button variant="ghost" size="sm" class="ml-auto" onclick={clearAllRules}>
								Clear all
							</Button>
						</div>
						<ul class="space-y-1.5">
							{#each rules as rule, idx (idx)}
								<li
									class="border-ink/15 bg-surface flex items-start justify-between gap-3 rounded-md border px-3 py-2"
								>
									<span class="font-body text-xs leading-snug text-ink">
										{describeRule(rule)}
									</span>
									<button
										type="button"
										onclick={() => generator.removeIncompatibleRule(idx)}
										aria-label="Remove rule"
										class="shrink-0 text-muted transition-colors hover:text-ink"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="bg-ink/[0.04] space-y-4 rounded-lg p-4">
					<div class="flex flex-wrap items-center gap-3">
						<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
							New rule
						</p>
						<div
							class="font-brains-medium ml-auto flex items-center gap-2 text-[10px] uppercase tracking-widest"
						>
							<span class={builderStep >= 1 ? 'text-ink' : 'text-muted'}>1. If</span>
							<ChevronRight class="h-3 w-3 text-muted" />
							<span class={builderStep >= 2 ? 'text-ink' : 'text-muted'}>2. Then block</span>
						</div>
					</div>

					{#if builderStep === 1}
						<div class="space-y-2">
							<p class="font-brains-medium text-[11px] uppercase tracking-widest text-ink">If</p>
							{#if draftConditions.length === 0}
								<p class="font-body text-xs text-muted">
									Add a layer condition to start a rule.
								</p>
							{/if}
							<div class="flex flex-wrap items-stretch gap-3">
								{#each draftConditions as cond, cIdx (cIdx)}
									<div
										class="border-ink/30 flex min-w-[180px] flex-col gap-2 rounded-md border-2 bg-charcoal/40 p-3"
									>
										<div class="flex items-center gap-2">
											<select
												value={cond.layerId}
												onchange={(e) => setConditionLayer(cIdx, e.currentTarget.value)}
												class="font-body flex-1 rounded-md border-2 border-ink bg-surface px-2 py-1 text-xs text-ink focus:outline-none"
											>
												{#each layers as l (l.id)}
													{#if l.id === cond.layerId || !usedConditionLayers.has(l.id)}
														<option value={l.id}>{l.name}</option>
													{/if}
												{/each}
											</select>
											<button
												type="button"
												onclick={() => removeCondition(cIdx)}
												aria-label="Remove condition layer"
												class="text-muted transition-colors hover:text-ink"
											>
												<X class="h-3.5 w-3.5" />
											</button>
										</div>
										<ul class="max-h-36 space-y-1 overflow-y-auto pr-1">
											{#each traitsOfLayer(cond.layerId) as trait (trait.id)}
												<li>
													<label
														class="flex cursor-pointer items-center gap-2 font-body text-xs text-ink"
													>
														<input
															type="checkbox"
															checked={cond.traitIds.includes(trait.id)}
															onchange={() => toggleConditionTrait(cIdx, trait.id)}
															class="accent-ink"
														/>
														<span class="truncate" title={trait.name}>{trait.name}</span>
													</label>
												</li>
											{/each}
										</ul>
									</div>
								{/each}

								{#if layers.length - draftConditions.length > 0}
									<button
										type="button"
										onclick={addConditionLayer}
										class="border-ink/30 hover:border-ink hover:bg-ink/[0.06] hover:text-ink font-brains-medium flex min-w-[120px] flex-col items-center justify-center gap-1 rounded-md border-2 bg-transparent px-4 py-3 text-[11px] uppercase tracking-wider text-muted transition-colors"
									>
										<Plus class="h-4 w-4" />
										Add layer
									</button>
								{/if}
							</div>
						</div>

						<div class="flex justify-end">
							<Button
								variant="primary"
								size="sm"
								onclick={() => (builderStep = 2)}
								disabled={!ifValid}
							>
								Continue
								<ChevronRight class="h-4 w-4" />
							</Button>
						</div>
					{:else}
						<div class="bg-ink/[0.05] space-y-1 rounded-md px-3 py-2">
							<p class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">If</p>
							<p class="font-body text-xs leading-snug text-ink">
								{describeIf(draftConditions)}
							</p>
						</div>

						<div class="space-y-2">
							<p class="font-brains-medium text-[11px] uppercase tracking-widest text-ink">
								Then block
							</p>
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div class="space-y-1">
									<label
										for="block-layer"
										class="font-brains-medium text-[10px] uppercase tracking-widest text-muted"
									>
										Layer
									</label>
									<Select id="block-layer" bind:value={draftBlockLayerId}>
										<option value="">Pick a layer</option>
										{#each availableForBlock as l (l.id)}
											<option value={l.id}>{l.name}</option>
										{/each}
									</Select>
								</div>
								<div class="space-y-1">
									<label
										for="block-trait"
										class="font-brains-medium text-[10px] uppercase tracking-widest text-muted"
									>
										Trait
									</label>
									<Select
										id="block-trait"
										bind:value={draftBlockTraitId}
										disabled={!draftBlockLayerId}
									>
										<option value="">
											{draftBlockLayerId ? 'Pick a trait' : 'Pick a layer first'}
										</option>
										{#each traitsOfLayer(draftBlockLayerId) as t (t.id)}
											<option value={t.id}>{t.name}</option>
										{/each}
									</Select>
								</div>
							</div>
						</div>

						<div class="flex items-center justify-between">
							<Button variant="ghost" size="sm" onclick={() => (builderStep = 1)}>
								<ChevronLeft class="h-4 w-4" />
								Back
							</Button>
							<Button variant="primary" size="sm" onclick={saveRule} disabled={!draftValid}>
								Add rule
							</Button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</section>
{/if}
