<script lang="ts">
	import { paywall } from '$lib/paywall.svelte';
	import Button from './ui/Button.svelte';
	import Modal from './ui/Modal.svelte';
	import {
		ExternalLink,
		Wallet,
		Sparkles,
		CreditCard,
		CheckCircle2,
		Loader2
	} from 'lucide-svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let busy = $state(false);
	let lastError = $state<string | null>(null);

	let quote = $state<{ usd: number; ethAmount: string; ethUsd: number } | null>(null);
	let quoteLoading = $state(false);
	let quoteError = $state<string | null>(null);

	function shortAddr(addr: string): string {
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
	}

	async function run(action: () => Promise<unknown>) {
		lastError = null;
		busy = true;
		try {
			await action();
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	async function loadQuote() {
		if (!paywall.hasReceiverConfig) return;
		quoteLoading = true;
		quoteError = null;
		try {
			quote = await paywall.quotePayment();
		} catch (err) {
			quoteError = err instanceof Error ? err.message : 'Could not fetch price';
		} finally {
			quoteLoading = false;
		}
	}

	$effect(() => {
		if (open && paywall.hasReceiverConfig && !quote && !quoteLoading) {
			void loadQuote();
		}
	});

	async function handlePay() {
		if (!quote) {
			lastError = 'ETH price not loaded.';
			return;
		}
		await run(async () => {
			await paywall.pay(quote!.ethAmount);
			if (paywall.unlocked) onClose();
		});
	}
</script>

<Modal {open} title="Unlock custom resolution" {onClose}>
	<div class="space-y-4">
		<p class="font-body text-sm text-ink">
			The free tier exports at 500×500. Unlock any resolution one of three ways:
		</p>

		<div class="bg-ink/[0.04] space-y-3 rounded-lg p-4">
			<div class="flex items-center gap-2">
				<Wallet class="h-4 w-4 text-ink" />
				<p class="font-brains-medium text-[11px] uppercase tracking-widest text-ink">
					1. Connect &amp; verify
				</p>
			</div>
			{#if !paywall.walletAddress}
				<Button
					variant="primary"
					size="md"
					class="w-full"
					onclick={() => run(paywall.connect)}
					disabled={busy}
				>
					Connect wallet
				</Button>
			{:else}
				<p class="font-mono text-xs text-muted">{shortAddr(paywall.walletAddress)}</p>
				{#if !paywall.siweVerified}
					<Button
						variant="primary"
						size="md"
						class="w-full"
						onclick={() => run(paywall.signIn)}
						disabled={busy}
					>
						Sign in with Ethereum
					</Button>
				{:else}
					<p
						class="font-brains-medium flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
					>
						<CheckCircle2 class="h-3.5 w-3.5" /> Verified
					</p>
				{/if}
			{/if}
		</div>

		{#if paywall.siweVerified && paywall.hasNftConfig}
			<div class="bg-ink/[0.04] space-y-3 rounded-lg p-4">
				<div class="flex items-center gap-2">
					<Sparkles class="h-4 w-4 text-ink" />
					<p class="font-brains-medium text-[11px] uppercase tracking-widest text-ink">
						Option A: Hold abasho or abashos
					</p>
				</div>
				{#if paywall.isHolder}
					<p
						class="font-brains-medium flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
					>
						<CheckCircle2 class="h-3.5 w-3.5" /> Holder confirmed, unlocked
					</p>
				{:else}
					<Button
						variant="secondary"
						size="md"
						class="w-full"
						onclick={() => run(paywall.checkHolder)}
						disabled={busy}
					>
						Check holder status
					</Button>
				{/if}
			</div>
		{/if}

		{#if paywall.siweVerified && paywall.hasReceiverConfig && !paywall.isHolder}
			<div class="bg-ink/[0.04] space-y-3 rounded-lg p-4">
				<div class="flex items-center gap-2">
					<CreditCard class="h-4 w-4 text-ink" />
					<p class="font-brains-medium text-[11px] uppercase tracking-widest text-ink">
						Option B: Pay once (${paywall.payAmountUsd})
					</p>
				</div>
				{#if paywall.hasPaid}
					<p
						class="font-brains-medium flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
					>
						<CheckCircle2 class="h-3.5 w-3.5" /> Payment received, unlocked
					</p>
				{:else}
					<div class="flex gap-4 text-xs text-ink">
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="radio"
								bind:group={paywall.payChain}
								value="mainnet"
								class="accent-ink"
							/>
							Mainnet
						</label>
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="radio"
								bind:group={paywall.payChain}
								value="base"
								class="accent-ink"
							/>
							Base
						</label>
					</div>
					{#if quoteLoading}
						<p class="font-mono flex items-center gap-2 text-xs text-muted">
							<Loader2 class="h-3.5 w-3.5 spin" /> Fetching ETH price…
						</p>
					{:else if quoteError}
						<p class="font-body text-xs text-red-700 dark:text-red-400">
							{quoteError}. <button
								type="button"
								onclick={loadQuote}
								class="underline underline-offset-2 hover:text-ink">Retry</button
							>
						</p>
					{:else if quote}
						<p class="font-mono text-xs text-muted">
							≈ {quote.ethAmount} ETH (at ${quote.ethUsd.toLocaleString()}/ETH)
						</p>
					{/if}
					<Button
						variant="primary"
						size="md"
						class="w-full"
						onclick={handlePay}
						disabled={busy || !quote}
					>
						Pay ${paywall.payAmountUsd} on {paywall.payChain === 'mainnet' ? 'Mainnet' : 'Base'}
					</Button>
				{/if}
			</div>
		{/if}

		{#if paywall.selfHostUrl}
			<div class="bg-ink/[0.04] rounded-lg p-4">
				<p class="font-brains-medium mb-2 text-[10px] uppercase tracking-widest text-muted">
					Option C: Self-host
				</p>
				<p class="font-body mb-3 text-xs text-ink">
					The whole thing is open source. Clone it and run it locally for free, no paywall.
				</p>
				<a
					href={paywall.selfHostUrl}
					target="_blank"
					rel="noreferrer"
					class="font-brains-medium inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-ink hover:underline"
				>
					<ExternalLink class="h-3 w-3" />
					View on GitHub
				</a>
			</div>
		{/if}

		{#if lastError}
			<p
				class="rounded-md border-2 border-red-600/40 bg-red-500/10 px-3 py-2 font-body text-xs text-red-700 dark:text-red-400"
			>
				{lastError}
			</p>
		{/if}

		{#if paywall.devBypass}
			<p
				class="rounded-md border-2 border-emerald-600/40 bg-emerald-500/10 px-3 py-2 font-body text-xs text-emerald-700 dark:text-emerald-400"
			>
				Dev mode: paywall is bypassed locally. Production builds enforce it.
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" size="md" onclick={onClose}>Close</Button>
	{/snippet}
</Modal>
