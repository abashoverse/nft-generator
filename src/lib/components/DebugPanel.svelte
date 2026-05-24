<script lang="ts">
	import { debugStore } from '$lib/stores/debug.svelte';
	import { Bug, Trash2, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-svelte';

	interface Check {
		label: string;
		ok: boolean;
		hint?: string;
	}

	interface Snapshot {
		label: string;
		value: string | number | boolean;
	}

	interface Props {
		step: number;
		title: string;
		checks?: Check[];
		snapshot?: Snapshot[];
	}

	let { step, title, checks = [], snapshot = [] }: Props = $props();

	let open = $state(true);
	let tab = $state<'state' | 'events'>('state');

	const events = $derived(debugStore.forStep(step));
	const passing = $derived(checks.filter((c) => c.ok).length);
	const total = $derived(checks.length);
	const allOk = $derived(total > 0 && passing === total);

	function formatTime(ts: number) {
		const d = new Date(ts);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
	}

	function levelClass(level: string) {
		switch (level) {
			case 'success':
				return 'text-emerald-700 dark:text-emerald-400';
			case 'warn':
				return 'text-amber-700 dark:text-amber-400';
			case 'error':
				return 'text-red-700 dark:text-red-400';
			default:
				return 'text-ink';
		}
	}
</script>

<section
	class="border-ink/25 bg-lcd-light mt-6 overflow-hidden rounded border font-mono text-xs"
>
	<header class="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
		<button
			type="button"
			onclick={() => (open = !open)}
			class="hover:bg-ink/5 inline-flex items-center gap-2 rounded px-2 py-1 transition-colors"
		>
			<Bug class="h-3.5 w-3.5 text-ink" />
			<span class="font-brains-medium text-[11px] uppercase tracking-wider text-ink">
				Debug · {title}
			</span>
			{#if total > 0}
				<span
					class="font-brains-medium rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider
					{allOk
						? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
						: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'}"
				>
					{passing}/{total} checks
				</span>
			{/if}
			{#if open}<ChevronDown class="h-3.5 w-3.5 text-muted" />{:else}<ChevronUp
					class="h-3.5 w-3.5 text-muted"
				/>{/if}
		</button>

		{#if open}
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={() => (tab = 'state')}
					class="font-brains-medium rounded border px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors
					{tab === 'state'
						? 'border-ink bg-ink text-on-ink'
						: 'border-transparent text-muted hover:bg-ink/5 hover:text-ink'}"
				>
					State
				</button>
				<button
					type="button"
					onclick={() => (tab = 'events')}
					class="font-brains-medium rounded border px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors
					{tab === 'events'
						? 'border-ink bg-ink text-on-ink'
						: 'border-transparent text-muted hover:bg-ink/5 hover:text-ink'}"
				>
					Events ({events.length})
				</button>
				<button
					type="button"
					onclick={debugStore.clear}
					title="Clear all events"
					class="hover:bg-ink/5 ml-1 rounded p-1 text-muted hover:text-ink"
				>
					<Trash2 class="h-3 w-3" />
				</button>
			</div>
		{/if}
	</header>

	{#if open}
		<div class="border-ink/25 space-y-4 border-t px-4 py-3">
			{#if tab === 'state'}
				{#if checks.length > 0}
					<div>
						<p class="font-brains-medium mb-2 text-[10px] uppercase tracking-widest text-muted">
							Gating checks
						</p>
						<ul class="space-y-1.5">
							{#each checks as c}
								<li class="flex items-start gap-2 text-xs">
									{#if c.ok}
										<CheckCircle2 class="mt-0.5 h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
									{:else}
										<XCircle class="mt-0.5 h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
									{/if}
									<span class="font-body {c.ok ? 'text-ink' : 'text-muted'}">{c.label}</span>
									{#if c.hint && !c.ok}
										<span class="font-body text-amber-700 dark:text-amber-400">
											— {c.hint}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if snapshot.length > 0}
					<div>
						<p class="font-brains-medium mb-2 text-[10px] uppercase tracking-widest text-muted">
							Snapshot
						</p>
						<dl class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
							{#each snapshot as s}
								<div
									class="border-border bg-lcd flex items-center justify-between gap-3 rounded border px-2.5 py-1 text-[11px]"
								>
									<dt class="font-brains-medium text-muted">{s.label}</dt>
									<dd class="font-mono truncate text-ink" title={String(s.value)}>
										{s.value}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				{/if}

				{#if checks.length === 0 && snapshot.length === 0}
					<p class="font-body italic text-muted">No state to show.</p>
				{/if}
			{:else}
				<div class="max-h-56 overflow-y-auto">
					{#if events.length === 0}
						<p class="font-body italic text-muted">No events logged for this step yet.</p>
					{:else}
						<ol class="space-y-0.5">
							{#each events as e (e.id)}
								<li
									class="hover:bg-ink/5 grid grid-cols-[88px_56px_1fr] gap-2 rounded px-1.5 py-0.5 text-[11px]"
								>
									<span class="text-muted">{formatTime(e.ts)}</span>
									<span
										class="font-brains-medium uppercase {levelClass(e.level)}"
									>
										{e.level}
									</span>
									<span class="break-words text-ink">{e.message}</span>
								</li>
							{/each}
						</ol>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</section>
