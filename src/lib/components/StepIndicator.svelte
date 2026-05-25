<script lang="ts">
	interface Props {
		current: number;
		onJump?: (step: number) => void;
		maxReached: number;
	}

	let { current, onJump, maxReached }: Props = $props();

	const steps = [
		{ n: 1, label: 'Setup' },
		{ n: 2, label: 'Layers' },
		{ n: 3, label: 'Preview' },
		{ n: 4, label: 'Export' }
	];
</script>

<div class="flex items-center gap-1.5">
	{#each steps as s, idx (s.n)}
		{@const reachable = s.n <= maxReached}
		{@const isActive = current === s.n}
		{@const isDone = current > s.n}
		<button
			type="button"
			disabled={!reachable}
			onclick={() => reachable && onJump?.(s.n)}
			aria-label={`Jump to step ${s.n}: ${s.label}`}
			class="font-brains-medium group flex flex-col items-center gap-1 rounded-md px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-ink/5"
		>
			<span
				class="flex h-8 w-8 items-center justify-center rounded-md border-2 text-[12px] font-bold transition-colors
				{isActive
					? 'border-ink bg-ink text-on-ink'
					: isDone
						? 'border-ink bg-transparent text-ink'
						: 'border-ink/30 bg-surface text-muted'}"
			>
				{isDone ? '✓' : s.n}
			</span>
			<span
				class="hidden text-[9px] uppercase tracking-wider sm:inline
				{isActive ? 'text-ink' : 'text-muted'}"
			>
				{s.label}
			</span>
		</button>
		{#if idx < steps.length - 1}
			<span
				class="h-px w-6 transition-colors
				{current > s.n ? 'bg-ink' : 'bg-ink/20'}"
				aria-hidden="true"
			></span>
		{/if}
	{/each}
</div>
