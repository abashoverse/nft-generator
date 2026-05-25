import type { Address } from 'viem';
import {
	PUBLIC_ABASHO_NFT_ADDRESS,
	PUBLIC_ABASHOS_NFT_ADDRESS,
	PUBLIC_PAY_RECEIVER_ADDRESS,
	PUBLIC_PAY_AMOUNT_USD,
	PUBLIC_SELF_HOST_URL,
	PUBLIC_FORCE_PAYWALL
} from '$env/static/public';
import {
	connectInjected,
	connectSpecificWallet,
	disconnectWallet,
	signSiwe,
	readNftBalance,
	getDelegatedVaults,
	sendPayment,
	getEthUsdPrice,
	usdToEthString,
	type Eip6963DetectedWallet,
	type SupportedChain
} from './web3';
export type { Eip6963DetectedWallet } from './web3';

// PUBLIC_FORCE_PAYWALL=true in .env lets you exercise the paywall flow during
// dev. Dev-only: in production builds this flag is ignored so a misconfigured
// .env can't lock a deploy with no real unlock options.
const forceFlagOn =
	typeof PUBLIC_FORCE_PAYWALL === 'string' &&
	PUBLIC_FORCE_PAYWALL.trim().toLowerCase() === 'true';
const FORCE_PAYWALL_IN_DEV = import.meta.env.DEV && forceFlagOn;

const DEV_BYPASS = import.meta.env.DEV && !FORCE_PAYWALL_IN_DEV;

if (typeof console !== 'undefined' && import.meta.env.DEV) {
	console.info(
		`[paywall] dev mode, ${FORCE_PAYWALL_IN_DEV ? 'forced ON' : 'bypassed'} (PUBLIC_FORCE_PAYWALL=${JSON.stringify(PUBLIC_FORCE_PAYWALL)})`
	);
}

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

const ABASHO_NFT = envAddress(PUBLIC_ABASHO_NFT_ADDRESS);
const ABASHOS_NFT = envAddress(PUBLIC_ABASHOS_NFT_ADDRESS);
const PAY_RECEIVER = envAddress(PUBLIC_PAY_RECEIVER_ADDRESS);
const PAY_AMOUNT_USD = Number(PUBLIC_PAY_AMOUNT_USD || '10');
const SELF_HOST_URL = envString(PUBLIC_SELF_HOST_URL);

const HAS_NFT_CONFIG = !!(ABASHO_NFT || ABASHOS_NFT);
const HAS_RECEIVER_CONFIG = !!PAY_RECEIVER;
const PAYWALL_ENABLED = FORCE_PAYWALL_IN_DEV || HAS_NFT_CONFIG || HAS_RECEIVER_CONFIG;

export const FREE_TIER_EXPORT_PX = 500;

function createPaywall() {
	// All state is in-memory only. No localStorage, no sessionStorage. Every
	// page load is a fresh session, the user has to reconnect and re-verify.
	let walletAddress = $state<Address | null>(null);
	let siweVerified = $state(false);
	let isHolder = $state(false);
	let hasPaid = $state(false);
	let payChain = $state<SupportedChain>('mainnet');

	const unlocked = $derived(
		DEV_BYPASS || !PAYWALL_ENABLED || (siweVerified && (isHolder || hasPaid))
	);

	function adoptAddress(addr: Address | null) {
		if (!addr) return null;
		// New wallet means previous SIWE/holder status no longer applies.
		if (walletAddress && walletAddress.toLowerCase() !== addr.toLowerCase()) {
			siweVerified = false;
			isHolder = false;
			hasPaid = false;
		}
		walletAddress = addr;
		return addr;
	}

	async function connect() {
		return adoptAddress(await connectInjected());
	}

	async function connectVia(wallet: Eip6963DetectedWallet) {
		return adoptAddress(await connectSpecificWallet(wallet));
	}

	async function signIn() {
		if (!walletAddress) throw new Error('Connect a wallet first.');
		const ok = await signSiwe(walletAddress);
		siweVerified = ok;
		return ok;
	}

	async function checkHolder() {
		if (!walletAddress || !siweVerified) throw new Error('Sign in first.');
		if (!HAS_NFT_CONFIG) throw new Error('Holder check is not configured.');

		const nftContracts: Address[] = [];
		if (ABASHO_NFT) nftContracts.push(ABASHO_NFT);
		if (ABASHOS_NFT) nftContracts.push(ABASHOS_NFT);

		const directChecks = nftContracts.map((c) => readNftBalance(c, walletAddress!));
		const vaults = await getDelegatedVaults(walletAddress, nftContracts);
		const delegatedChecks = vaults.flatMap((v) =>
			nftContracts.map((c) => readNftBalance(c, v))
		);

		const balances = await Promise.all([...directChecks, ...delegatedChecks]);
		isHolder = balances.some((b) => b > 0n);
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
		return txHash;
	}

	async function disconnect() {
		await disconnectWallet();
		walletAddress = null;
		siweVerified = false;
		isHolder = false;
		hasPaid = false;
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
		connectVia,
		signIn,
		checkHolder,
		quotePayment,
		pay,
		disconnect
	};
}

export const paywall = createPaywall();
