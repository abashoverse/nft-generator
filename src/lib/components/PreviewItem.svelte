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
	class="group flex flex-col gap-2 rounded-lg border-2 border-ink/30 bg-surface p-2 transition-colors duration-200 ease-out hover:border-ink"
>
	<canvas bind:this={canvas} width={120} height={120} class="aspect-square w-full rounded-md bg-surface"></canvas>
	<p
		class="font-brains-medium text-[10px] uppercase tracking-wider text-muted group-hover:text-ink"
	>
		#{index}
	</p>
</div>
