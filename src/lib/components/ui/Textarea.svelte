<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { twMerge } from 'tailwind-merge';

	interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
		class?: string;
		value?: string;
	}

	let { class: className, value = $bindable(''), ...restProps }: Props = $props();

	const base =
		'font-body w-full rounded border border-border bg-lcd-light px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-50';
</script>

<textarea class={twMerge(base, className)} bind:value {...restProps}></textarea>
