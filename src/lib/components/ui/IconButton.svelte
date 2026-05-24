<script lang="ts">
	import type { Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		onclick?: () => void;
		ariaLabel: string;
		disabled?: boolean;
		title?: string;
		class?: string;
		children: Snippet;
	}

	let {
		onclick,
		ariaLabel,
		disabled = false,
		title,
		class: className,
		children
	}: Props = $props();

	const base =
		'relative inline-flex h-10 w-10 items-center justify-center rounded border border-transparent text-muted transition-colors hover:border-border hover:bg-lcd-light hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed';
</script>

<button
	type="button"
	{onclick}
	{disabled}
	{title}
	class={twMerge(base, className)}
	aria-label={ariaLabel}
>
	{@render children()}
</button>
