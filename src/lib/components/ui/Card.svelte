<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	const card = tv({
		base: 'rounded-lg border-2 border-ink bg-surface',
		variants: {
			padding: {
				none: '',
				sm: 'p-4',
				md: 'p-6',
				lg: 'p-8'
			},
			variant: {
				default: '',
				inset: 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]',
				panel: ''
			},
			hover: {
				true: 'group cursor-pointer transition-colors duration-200 ease-out hover:bg-ink hover:text-on-ink',
				false: ''
			}
		},
		defaultVariants: {
			padding: 'md',
			variant: 'default',
			hover: false
		}
	});

	type CardVariants = VariantProps<typeof card>;

	interface Props extends HTMLAttributes<HTMLDivElement> {
		padding?: CardVariants['padding'];
		variant?: CardVariants['variant'];
		hover?: CardVariants['hover'];
		children: Snippet;
		class?: string;
	}

	let { padding, variant, hover, children, class: className, ...restProps }: Props = $props();
</script>

<div class={card({ padding, variant, hover, class: className })} {...restProps}>
	{@render children()}
</div>
