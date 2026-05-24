<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { HTMLInputAttributes } from 'svelte/elements';

	const input = tv({
		base: 'font-body w-full rounded border bg-lcd-light px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-50',
		variants: {
			variant: {
				default: 'border-border',
				error: 'border-red-500 focus:border-red-500 focus:ring-red-500'
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
