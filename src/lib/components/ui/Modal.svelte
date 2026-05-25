<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title?: string;
		onClose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let { open, title, onClose, children, footer }: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialog) onClose();
	}
</script>

<dialog
	bind:this={dialog}
	onclose={onClose}
	onclick={handleBackdropClick}
	class="fixed inset-0 m-auto w-[90vw] max-w-md rounded-lg border-2 border-ink bg-charcoal p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
>
	<div class="flex flex-col">
		{#if title}
			<header class="flex items-center justify-between border-b-2 border-ink px-5 py-3">
				<h2 class="font-display text-base font-semibold tracking-tight text-ink">{title}</h2>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close"
					class="hover:bg-ink/10 rounded p-1 text-muted transition-colors hover:text-ink"
				>
					<X class="h-4 w-4" />
				</button>
			</header>
		{/if}
		<div class="px-5 py-4">
			{@render children()}
		</div>
		{#if footer}
			<footer class="flex justify-end gap-2 border-t-2 border-ink px-5 py-3">
				{@render footer()}
			</footer>
		{/if}
	</div>
</dialog>
