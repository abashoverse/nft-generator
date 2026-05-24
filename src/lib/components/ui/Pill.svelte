<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tv, type VariantProps } from 'tailwind-variants';

	const pill = tv({
		base: 'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-brains-medium text-[10px] uppercase tracking-wider',
		variants: {
			tone: {
				ink: 'border-ink bg-ink text-on-ink',
				outline: 'border-border bg-transparent text-ink',
				muted: 'border-transparent bg-lcd-light text-muted',
				warn: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
				success: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
				danger: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300'
			}
		},
		defaultVariants: {
			tone: 'outline'
		}
	});

	type PillVariants = VariantProps<typeof pill>;

	interface Props {
		tone?: PillVariants['tone'];
		children: Snippet;
		class?: string;
	}

	let { tone, children, class: className }: Props = $props();
</script>

<span class={pill({ tone, class: className })}>
	{@render children()}
</span>
