<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	const button = tv({
		base: 'font-brains-medium inline-flex cursor-pointer items-center justify-center gap-2 rounded-md uppercase tracking-wider transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50',
		variants: {
			variant: {
				primary:
					'border-2 border-ink bg-ink text-on-ink hover:bg-charcoal hover:text-ink',
				secondary:
					'border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-on-ink',
				outline: 'border-2 border-border bg-transparent text-ink hover:border-ink',
				ghost: 'border-2 border-transparent text-ink hover:border-ink',
				destructive:
					'border-2 border-red-600 bg-red-600 text-white hover:bg-transparent hover:text-red-600'
			},
			size: {
				sm: 'h-8 px-3 text-xs',
				md: 'h-10 px-4 text-sm',
				lg: 'h-12 px-6 text-base',
				icon: 'h-10 w-10'
			}
		},
		defaultVariants: {
			variant: 'primary',
			size: 'md'
		}
	});

	type ButtonVariants = VariantProps<typeof button>;

	interface Props extends HTMLButtonAttributes {
		variant?: ButtonVariants['variant'];
		size?: ButtonVariants['size'];
		children: Snippet;
		class?: string;
	}

	let { variant, size, children, class: className, ...restProps }: Props = $props();
</script>

<button class={button({ variant, size, class: className })} {...restProps}>
	{@render children()}
</button>
