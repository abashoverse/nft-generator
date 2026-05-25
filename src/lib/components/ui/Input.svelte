<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { HTMLInputAttributes } from 'svelte/elements';

	const input = tv({
		base: 'font-body w-full rounded-md border-2 bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-1 focus-visible:ring-offset-charcoal disabled:cursor-not-allowed disabled:opacity-50',
		variants: {
			variant: {
				default: 'border-ink',
				error: 'border-red-500 focus-visible:ring-red-500/40'
			},
			inputSize: {
				sm: 'h-8 text-xs',
				md: 'h-10 text-sm',
				lg: 'h-12 text-base'
			}
		},
		defaultVariants: {
			variant: 'default',
			inputSize: 'md'
		}
	});

	type InputVariants = VariantProps<typeof input>;

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		variant?: InputVariants['variant'];
		inputSize?: InputVariants['inputSize'];
		class?: string;
		value?: string | number;
	}

	let {
		variant,
		inputSize,
		class: className,
		value = $bindable(''),
		...restProps
	}: Props = $props();
</script>

<input class={input({ variant, inputSize, class: className })} bind:value {...restProps} />
