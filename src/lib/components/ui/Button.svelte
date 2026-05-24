<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	const button = tv({
		base: 'font-body inline-flex cursor-pointer items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-lcd disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50',
		variants: {
			variant: {
				primary:
					'border border-ink bg-ink text-on-ink hover:bg-transparent hover:text-ink',
				secondary: 'border border-border bg-transparent text-ink hover:bg-ink/10',
				outline: 'border border-border bg-transparent text-ink hover:border-ink',
				ghost: 'text-ink hover:bg-ink/10',
				destructive:
					'border border-red-600 bg-red-600 text-white hover:bg-transparent hover:text-red-600'
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
