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
		'font-body w-full rounded-md border-2 border-ink bg-surface px-3 py-2 text-sm text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-1 focus-visible:ring-offset-charcoal disabled:cursor-not-allowed disabled:opacity-50';
</script>

<select class={twMerge(base, className)} bind:value {...restProps}>
	{@render children()}
</select>
