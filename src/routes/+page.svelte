<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';
	import StepIndicator from '$lib/components/StepIndicator.svelte';
	import StepNav from '$lib/components/StepNav.svelte';
	import Step1Setup from '$lib/components/Step1Setup.svelte';
	import Step2Layers from '$lib/components/Step2Layers.svelte';
	import Step3Preview from '$lib/components/Step3Preview.svelte';
	import Step4Export from '$lib/components/Step4Export.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let step = $state(1);
	let busy = $state(false);

	const config = $derived(generator.config);
	const layers = $derived(generator.layers);
	const collection = $derived(generator.collection);

	const allTraitsHaveDims = $derived(
		layers.length > 0 &&
			layers.every((l) => l.traits.every((t) => t.width !== undefined && t.height !== undefined))
	);
	const uniqueImageSizes = $derived(
		new Set(
			layers
				.flatMap((l) => l.traits)
				.filter((t) => t.width && t.height)
				.map((t) => `${t.width}x${t.height}`)
		).size
	);
	const dimensionsConsistent = $derived(allTraitsHaveDims && uniqueImageSizes <= 1);

	const step1Valid = $derived(
		config.name.trim() !== '' &&
			layers.length > 0 &&
			config.size > 0 &&
			dimensionsConsistent &&
			(!config.usePreReveal || config.preRevealImage !== null)
	);
	const step2Valid = $derived(layers.length > 0 && layers.every((l) => l.traits.length > 0));
	const step3Valid = $derived(collection.length > 0);

	const maxReached = $derived(step1Valid ? (step2Valid ? (step3Valid ? 4 : 3) : 2) : 1);

	function next() {
		if (blockReason()) return;
		step = Math.min(4, step + 1);
	}

	function back() {
		step = Math.max(1, step - 1);
	}

	function jump(target: number) {
		if (target > maxReached) return;
		step = target;
	}

	function blockReason(): string {
		if (step === 1 && !step1Valid) {
			if (!config.name.trim()) return 'Collection name is required';
			if (layers.length === 0) return 'Load a layers folder';
			if (config.size <= 0) return 'Collection size must be > 0';
			if (!allTraitsHaveDims) return 'Still checking image dimensions…';
			if (uniqueImageSizes > 1) return 'All trait images must share the same dimensions';
			if (config.usePreReveal && !config.preRevealImage)
				return 'Pre-reveal image is required when pre-reveal is on';
		}
		if (step === 2 && !step2Valid) return 'Every layer must have at least one trait';
		if (step === 3 && !step3Valid) return 'Generate the collection first';
		return '';
	}

	const nextLabel = $derived.by(() => {
		switch (step) {
			case 1:
				return 'Configure Layers →';
			case 2:
				return 'Generate Collection →';
			case 3:
				return 'Generate & Export →';
			default:
				return 'Done';
		}
	});
</script>

<div class="grid min-h-screen grid-rows-[auto_1fr_auto] bg-lcd">
	<header
		class="bg-lcd/85 border-border sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b-2 px-4 py-3 backdrop-blur-sm sm:px-8"
	>
		<a
			href="/"
			class="flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-ink/5"
		>
			<img src="/OCB.svg" alt="OCB" class="h-8 w-8 dark:invert" />
			<div class="flex flex-col leading-tight">
				<span class="font-array-bold text-lg text-ink">nft generator</span>
				<span class="font-brains-medium text-[10px] uppercase tracking-widest text-muted">
					Generative Art Engine
				</span>
			</div>
		</a>

		<StepIndicator current={step} {maxReached} onJump={jump} />

		<div class="flex items-center gap-2">
			<ThemeToggle />
		</div>
	</header>

	<main class="mx-auto flex w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-6">
		<section class="border-border bg-lcd rounded-lg border-2">
			<div class="p-5 sm:p-8">
				{#if step === 1}
					<Step1Setup />
				{:else if step === 2}
					<Step2Layers />
				{:else if step === 3}
					<Step3Preview bind:busy />
				{:else if step === 4}
					<Step4Export bind:busy />
				{/if}
			</div>
		</section>

	</main>

	<footer class="sticky bottom-0 z-30">
		<StepNav
			onBack={step > 1 ? back : undefined}
			onNext={step < 4 ? next : undefined}
			{busy}
			{nextLabel}
			nextDisabled={!!blockReason()}
			nextReason={blockReason()}
		/>
	</footer>
</div>
