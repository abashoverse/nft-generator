<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		actions?: Snippet;
	}

	let { label, actions }: Props = $props();
</script>

<div class="mb-3 flex items-center justify-between">
	<p class="font-brains-medium text-xs uppercase tracking-wider text-muted">{label}</p>
	{#if actions}
		<div class="flex gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
