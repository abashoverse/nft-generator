<script lang="ts">
	import Button from './ui/Button.svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

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
		backLabel = 'Back',
		nextLabel = 'Continue',
		nextDisabled = false,
		nextReason = '',
		busy = false
	}: Props = $props();
</script>

<div
	class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 md:px-5"
>
	<div class="flex items-center">
		{#if onBack}
			<Button variant="outline" size="md" onclick={onBack} disabled={busy}>
				<ChevronLeft class="h-4 w-4" />
				{backLabel}
			</Button>
		{/if}
	</div>

	<div class="text-center text-xs font-brains-medium text-muted" aria-live="polite">
		{#if nextDisabled && nextReason}
			<span class="text-amber-700 dark:text-amber-400">{nextReason}</span>
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
				<ChevronRight class="h-4 w-4" />
			</Button>
		{/if}
	</div>
</div>
