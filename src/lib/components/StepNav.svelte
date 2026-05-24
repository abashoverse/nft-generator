<script lang="ts">
	import Button from './ui/Button.svelte';

	interface Props {
		onBack?: () => void;
		onNext?: () => void;
		backLabel?: string;
		nextLabel?: string;
		nextDisabled?: boolean;
		nextReason?: string;
		busy?: boolean;
	}

	let {
		onBack,
		onNext,
		backLabel = '← Back',
		nextLabel = 'Continue →',
		nextDisabled = false,
		nextReason = '',
		busy = false
	}: Props = $props();
</script>

<div
	class="bg-lcd/90 border-border grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t-2 px-6 py-3 backdrop-blur-sm"
>
	<div class="flex items-center">
		{#if onBack}
			<Button variant="outline" size="md" onclick={onBack} disabled={busy}>{backLabel}</Button>
		{/if}
	</div>

	<div class="text-center text-xs font-brains-medium text-muted" aria-live="polite">
		{#if nextDisabled && nextReason}
			<span class="text-amber-700 dark:text-amber-400">⚠ {nextReason}</span>
		{/if}
	</div>

	<div class="flex items-center justify-end">
		{#if onNext}
			<Button
				variant="primary"
				size="md"
				onclick={onNext}
				disabled={nextDisabled || busy}
				title={nextReason}
			>
				{nextLabel}
			</Button>
		{/if}
	</div>
</div>
