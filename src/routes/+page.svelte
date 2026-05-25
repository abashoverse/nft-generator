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
				return 'Configure Layers';
			case 2:
				return 'Generate Collection';
			case 3:
				return 'Generate & Export';
			default:
				return 'Done';
		}
	});
</script>

<div class="grid min-h-screen grid-rows-[auto_1fr_auto] bg-charcoal">
	<header class="sticky top-0 z-50 w-full" aria-label="Top bar">
		<div class="mx-auto w-full max-w-7xl px-4 py-3 md:px-6 md:py-4">
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[0.08] px-4 py-3 backdrop-blur-md backdrop-saturate-150 dark:bg-white/[0.08] md:px-5"
			>
				<a href="/" class="group flex items-center gap-2">
					<span
						class="block h-7 w-7 bg-ink md:h-8 md:w-8"
						style="mask: url('/OCB.svg') no-repeat center / contain; -webkit-mask: url('/OCB.svg') no-repeat center / contain;"
						aria-hidden="true"
					></span>
					<span
						class="font-display text-base font-semibold tracking-tight text-ink md:text-lg"
					>
						nft generator
					</span>
				</a>

				<StepIndicator current={step} {maxReached} onJump={jump} />

				<ThemeToggle />
			</div>
		</div>
	</header>

	<main
		class="mx-auto flex w-full max-w-7xl flex-col justify-center gap-4 px-4 py-2.5 md:px-6 md:py-5"
	>
		{#if step === 1}
			<Step1Setup />
		{:else if step === 2}
			<Step2Layers />
		{:else if step === 3}
			<Step3Preview bind:busy />
		{:else if step === 4}
			<Step4Export bind:busy />
		{/if}
	</main>

	<footer class="sticky bottom-0 z-50 w-full">
		<div class="mx-auto w-full max-w-7xl px-4 py-3 md:px-6 md:py-4">
			<div
				class="rounded-lg bg-black/[0.08] backdrop-blur-md backdrop-saturate-150 dark:bg-white/[0.08]"
			>
				<StepNav
					onBack={step > 1 ? back : undefined}
					onNext={step < 4 ? next : undefined}
					{busy}
					{nextLabel}
					nextDisabled={!!blockReason()}
					nextReason={blockReason()}
				/>
			</div>
		</div>
	</footer>
</div>
