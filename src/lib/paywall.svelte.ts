import type { Address } from 'viem';
import {
	connectWallet,
	signSiwe,
	readNftBalance,
	sendPayment,
	getEthUsdPrice,
	usdToEthString,
	type SupportedChain
} from './web3';

const STORAGE_KEY = 'nft-gen-paywall-v1';
const DEV_BYPASS = import.meta.env.DEV;

function envAddress(raw: unknown): Address | null {
	if (typeof raw !== 'string') return null;
	const t = raw.trim();
	if (!/^0x[0-9a-fA-F]{40}$/.test(t)) return null;
	return t as Address;
}

function envString(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const t = raw.trim();
	return t.length > 0 ? t : null;
}

const ABASHO_NFT = envAddress(import.meta.env.PUBLIC_ABASHO_NFT_ADDRESS);
const ABASHOS_NFT = envAddress(import.meta.env.PUBLIC_ABASHOS_NFT_ADDRESS);
const PAY_RECEIVER = envAddress(import.meta.env.PUBLIC_PAY_RECEIVER_ADDRESS);
const PAY_AMOUNT_USD = Number(import.meta.env.PUBLIC_PAY_AMOUNT_USD || '10');
const SELF_HOST_URL = envString(import.meta.env.PUBLIC_SELF_HOST_URL);

const HAS_NFT_CONFIG = !!(ABASHO_NFT || ABASHOS_NFT);
const HAS_RECEIVER_CONFIG = !!PAY_RECEIVER;
const PAYWALL_ENABLED = HAS_NFT_CONFIG || HAS_RECEIVER_CONFIG;

export const FREE_TIER_EXPORT_PX = 500;

interface Persisted {
	walletAddress?: Address;
	siweVerified?: boolean;
	isHolder?: boolean;
	hasPaid?: boolean;
}

function load(): Persisted {
	if (typeof localStorage === 'undefined') return {};
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
	} catch {
		return {};
	}
}

function save(state: Persisted) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createPaywall() {
	const stored = load();
	let walletAddress = $state<Address | null>(stored.walletAddress ?? null);
	let siweVerified = $state(stored.siweVerified ?? false);
	let isHolder = $state(stored.isHolder ?? false);
	let hasPaid = $state(stored.hasPaid ?? false);
	let payChain = $state<SupportedChain>('mainnet');

	// Bypass paywall in three cases:
	//   1. Running in dev mode (vite dev sets import.meta.env.DEV).
	//   2. No gating env vars configured at all (deploy without paywall).
	//   3. User has verified + (holder OR paid).
	const unlocked = $derived(
		DEV_BYPASS || !PAYWALL_ENABLED || (siweVerified && (isHolder || hasPaid))
	);

	function persist() {
		save({
			walletAddress: walletAddress ?? undefined,
			siweVerified,
			isHolder,
			hasPaid
		});
	}

	async function connect() {
		const addr = await connectWallet();
		if (!addr) return null;
		if (walletAddress && walletAddress.toLowerCase() !== addr.toLowerCase()) {
			siweVerified = false;
			isHolder = false;
			hasPaid = false;
		}
		walletAddress = addr;
		persist();
		return addr;
	}

	async function signIn() {
		if (!walletAddress) throw new Error('Connect a wallet first.');
		const ok = await signSiwe(walletAddress);
		siweVerified = ok;
		persist();
		return ok;
	}

	async function checkHolder() {
		if (!walletAddress || !siweVerified) throw new Error('Sign in first.');
		if (!HAS_NFT_CONFIG) throw new Error('Holder check is not configured.');
		const checks: Promise<bigint>[] = [];
		if (ABASHO_NFT) checks.push(readNftBalance(ABASHO_NFT, walletAddress));
		if (ABASHOS_NFT) checks.push(readNftBalance(ABASHOS_NFT, walletAddress));
		const balances = await Promise.all(checks);
		isHolder = balances.some((b) => b > 0n);
		persist();
		return isHolder;
	}

	async function quotePayment(): Promise<{ usd: number; ethAmount: string; ethUsd: number }> {
		const ethUsd = await getEthUsdPrice();
		const ethAmount = usdToEthString(PAY_AMOUNT_USD, ethUsd);
		return { usd: PAY_AMOUNT_USD, ethAmount, ethUsd };
	}

	async function pay(ethAmount: string) {
		if (!walletAddress || !siweVerified) throw new Error('Sign in first.');
		if (!PAY_RECEIVER) throw new Error('Payment receiver is not configured.');
		const txHash = await sendPayment(payChain, PAY_RECEIVER, ethAmount);
		hasPaid = true;
		persist();
		return txHash;
	}

	function disconnect() {
		walletAddress = null;
		siweVerified = false;
		isHolder = false;
		hasPaid = false;
		persist();
	}

	return {
		get walletAddress() {
			return walletAddress;
		},
		get siweVerified() {
			return siweVerified;
		},
		get isHolder() {
			return isHolder;
		},
		get hasPaid() {
			return hasPaid;
		},
		get unlocked() {
			return unlocked;
		},
		get payChain() {
			return payChain;
		},
		set payChain(v: SupportedChain) {
			payChain = v;
		},
		get devBypass() {
			return DEV_BYPASS;
		},
		get paywallEnabled() {
			return PAYWALL_ENABLED;
		},
		get hasNftConfig() {
			return HAS_NFT_CONFIG;
		},
		get hasReceiverConfig() {
			return HAS_RECEIVER_CONFIG;
		},
		get payAmountUsd() {
			return PAY_AMOUNT_USD;
		},
		get selfHostUrl() {
			return SELF_HOST_URL;
		},
		connect,
		signIn,
		checkHolder,
		quotePayment,
		pay,
		disconnect
	};
}

export const paywall = createPaywall();
