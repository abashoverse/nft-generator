<script lang="ts">
	import { generator } from '$lib/stores/generator.svelte';

	interface Props {
		combo: string[];
		index: number;
	}

	let { combo, index }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		void combo;
		if (canvas) {
			generator.drawCombo(combo, canvas, 120);
		}
	});
</script>

<div
	class="border-border bg-lcd group flex flex-col gap-2 rounded border p-2 transition-colors hover:border-ink"
>
	<canvas bind:this={canvas} width={120} height={120} class="aspect-square w-full rounded bg-lcd-light"></canvas>
	<p
		class="font-brains-medium text-[10px] uppercase tracking-wider text-muted group-hover:text-ink"
	>
		#{index}
	</p>
</div>
