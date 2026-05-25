<script lang="ts">
	import { onMount } from 'svelte';
	import { paywall, type Eip6963DetectedWallet } from '$lib/paywall.svelte';
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
	let detectedWallets = $state<Eip6963DetectedWallet[]>([]);
	let holderCheckAttempted = $state(false);

	let quote = $state<{ usd: number; ethAmount: string; ethUsd: number } | null>(null);
	let quoteLoading = $state(false);
	let quoteError = $state<string | null>(null);

	interface Eip6963AnnounceEvent extends Event {
		detail?: Eip6963DetectedWallet;
	}

	onMount(() => {
		const onAnnounce = (e: Event) => {
			const evt = e as Eip6963AnnounceEvent;
			if (!evt.detail) return;
			const next = evt.detail;
			detectedWallets = [
				...detectedWallets.filter((w) => w.info.uuid !== next.info.uuid),
				next
			];
		};
		window.addEventListener('eip6963:announceProvider', onAnnounce);
		window.dispatchEvent(new Event('eip6963:requestProvider'));
		return () => window.removeEventListener('eip6963:announceProvider', onAnnounce);
	});

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

	async function handleCheckHolder() {
		await run(async () => {
			await paywall.checkHolder();
			holderCheckAttempted = true;
		});
	}

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
				{#if detectedWallets.length > 0}
					<div class="space-y-2">
						{#each detectedWallets as wallet (wallet.info.uuid)}
							<button
								type="button"
								onclick={() => run(() => paywall.connectVia(wallet))}
								disabled={busy}
								class="border-ink/30 bg-surface hover:border-ink hover:bg-ink/[0.06] flex w-full items-center gap-3 rounded-md border-2 px-3 py-2 text-left text-xs text-ink transition-colors disabled:opacity-50"
							>
								<img
									src={wallet.info.icon}
									alt=""
									class="h-5 w-5 shrink-0 rounded"
								/>
								<span class="font-body flex-1">{wallet.info.name}</span>
							</button>
						{/each}
					</div>
				{:else}
					<Button
						variant="primary"
						size="md"
						class="w-full"
						onclick={() => run(paywall.connect)}
						disabled={busy}
					>
						Connect browser wallet
					</Button>
				{/if}
			{:else}
				<div class="flex items-center justify-between gap-2">
					<p class="font-mono text-xs text-muted">{shortAddr(paywall.walletAddress)}</p>
					<button
						type="button"
						onclick={() => run(paywall.disconnect)}
						class="font-brains-medium text-[10px] uppercase tracking-widest text-muted hover:text-ink"
					>
						Disconnect
					</button>
				</div>
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
					<p class="font-body text-xs text-muted">
						Checks your connected wallet plus any vault that delegated to it via
						<a
							href="https://delegate.xyz"
							target="_blank"
							rel="noreferrer"
							class="text-ink underline underline-offset-2 hover:text-ink">delegate.xyz</a
						>.
					</p>
					{#if holderCheckAttempted && !busy}
						<p
							class="font-brains-medium text-[11px] uppercase tracking-widest text-amber-700 dark:text-amber-400"
						>
							No abasho or abashos holdings found in this wallet or any vault delegated to it.
						</p>
					{/if}
					<Button
						variant="secondary"
						size="md"
						class="w-full"
						onclick={handleCheckHolder}
						disabled={busy}
					>
						{#if busy}
							<Loader2 class="h-4 w-4 spin" /> Checking…
						{:else if holderCheckAttempted}
							Check again
						{:else}
							Check holder status
						{/if}
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
					<div
						class="grid grid-cols-2 overflow-hidden rounded-md border-2 border-ink"
						role="radiogroup"
						aria-label="Payment chain"
					>
						<button
							type="button"
							role="radio"
							aria-checked={paywall.payChain === 'mainnet'}
							onclick={() => (paywall.payChain = 'mainnet')}
							class="font-brains-medium px-3 py-2 text-xs uppercase tracking-wider transition-colors
							{paywall.payChain === 'mainnet'
								? 'bg-ink text-on-ink'
								: 'bg-transparent text-ink hover:bg-ink/[0.06]'}"
						>
							Mainnet
						</button>
						<button
							type="button"
							role="radio"
							aria-checked={paywall.payChain === 'base'}
							onclick={() => (paywall.payChain = 'base')}
							class="font-brains-medium border-l-2 border-ink px-3 py-2 text-xs uppercase tracking-wider transition-colors
							{paywall.payChain === 'base'
								? 'bg-ink text-on-ink'
								: 'bg-transparent text-ink hover:bg-ink/[0.06]'}"
						>
							Base
						</button>
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
