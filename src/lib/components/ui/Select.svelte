<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		class?: string;
		value?: string;
		children: Snippet;
	}

	let { class: className, value = $bindable(''), children, ...restProps }: Props = $props();

	const base =
		'font-body w-full rounded border border-border bg-lcd-light px-3 py-2 text-sm text-ink transition-colors focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-50';
</script>

<select class={twMerge(base, className)} bind:value {...restProps}>
	{@render children()}
</select>
