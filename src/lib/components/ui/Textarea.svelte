<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { twMerge } from 'tailwind-merge';

	interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
		class?: string;
		value?: string;
	}

	let { class: className, value = $bindable(''), ...restProps }: Props = $props();

	const base =
		'font-body w-full rounded-md border-2 border-ink bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-1 focus-visible:ring-offset-charcoal disabled:cursor-not-allowed disabled:opacity-50';
</script>

<textarea class={twMerge(base, className)} bind:value {...restProps}></textarea>
