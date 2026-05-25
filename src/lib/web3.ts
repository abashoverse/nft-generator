import {
	connect,
	disconnect,
	getAccount,
	getChainId,
	sendTransaction,
	signMessage,
	switchChain
} from '@wagmi/core';
import { injected } from '@wagmi/connectors';
import {
	createPublicClient,
	http,
	parseEther,
	verifyMessage,
	type Address,
	type Hex
} from 'viem';
import { mainnet, base } from 'viem/chains';
import { wagmiConfig, injectedConnector, mainnetTransport } from './wagmi';

export type SupportedChain = 'mainnet' | 'base';

// EIP-6963: each modern wallet extension announces itself with this shape so
// we can show a picker instead of fighting over window.ethereum.
export interface Eip6963ProviderInfo {
	uuid: string;
	name: string;
	icon: string;
	rdns: string;
}
export interface Eip6963DetectedWallet {
	info: Eip6963ProviderInfo;
	provider: unknown;
}

const erc721Abi = [
	{
		name: 'balanceOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'owner', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }]
	}
] as const;

// delegate.xyz Delegate Registry V2, deployed at the same address on every supported chain.
const DELEGATE_REGISTRY_V2: Address = '0x00000000000000447e69651d841bD8D104Bed493';

const delegateRegistryAbi = [
	{
		name: 'getIncomingDelegations',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'to', type: 'address' }],
		outputs: [
			{
				type: 'tuple[]',
				components: [
					{ name: 'type_', type: 'uint8' },
					{ name: 'to', type: 'address' },
					{ name: 'from', type: 'address' },
					{ name: 'rights', type: 'bytes32' },
					{ name: 'contract_', type: 'address' },
					{ name: 'tokenId', type: 'uint256' },
					{ name: 'amount', type: 'uint256' }
				]
			}
		]
	}
] as const;

const EMPTY_RIGHTS = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface RawDelegation {
	type_: number;
	to: Address;
	from: Address;
	rights: `0x${string}`;
	contract_: Address;
	tokenId: bigint;
	amount: bigint;
}

const mainnetPublic = createPublicClient({
	chain: mainnet,
	transport: mainnetTransport
});

// Connect via a plain injected provider (whichever wallet hijacked window.ethereum).
// Use this as a fallback when EIP-6963 announce didn't fire. We force mainnet
// during connect because the holder check reads mainnet contracts and the
// SIWE message bakes the current chainId into its body.
export async function connectInjected(): Promise<Address | null> {
	const result = await connect(wagmiConfig, {
		connector: injectedConnector,
		chainId: mainnet.id
	});
	await ensureMainnet();
	return (result.accounts[0] as Address) ?? null;
}

// Connect to a specific wallet announced via EIP-6963. Avoids the collision
// where two extensions both want to be window.ethereum.
export async function connectSpecificWallet(
	wallet: Eip6963DetectedWallet
): Promise<Address | null> {
	try {
		await disconnect(wagmiConfig);
	} catch {
		// nothing was connected; fine
	}
	const connector = injected({
		target: () => ({
			id: wallet.info.rdns,
			name: wallet.info.name,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			provider: wallet.provider as any
		})
	});
	const result = await connect(wagmiConfig, { connector, chainId: mainnet.id });
	await ensureMainnet();
	return (result.accounts[0] as Address) ?? null;
}

// Some wallets ignore the chainId option on connect, so we double-check after
// and request the switch explicitly. No-op if already on mainnet.
async function ensureMainnet(): Promise<void> {
	if (getChainId(wagmiConfig) === mainnet.id) return;
	try {
		await switchChain(wagmiConfig, { chainId: mainnet.id });
	} catch (err) {
		console.warn('[web3] could not switch to mainnet after connect', err);
	}
}

export async function disconnectWallet(): Promise<void> {
	try {
		await disconnect(wagmiConfig);
	} catch {
		// already disconnected
	}
}

export function currentConnectedAddress(): Address | null {
	return getAccount(wagmiConfig).address ?? null;
}

// Hand-rolled EIP-4361 message. We skip the `siwe` library because its CJS
// source has a top-level require('ethers') that breaks esbuild bundling.
// The wire format is the same; viem's verifyMessage does the actual sig math.
function buildSiweMessage(address: Address, nonce: string, chainId: number): string {
	const domain = window.location.host;
	const origin = window.location.origin;
	const issuedAt = new Date().toISOString();
	return `${domain} wants you to sign in with your Ethereum account:
${address}

Unlock custom export resolution for the NFT Generator.

URI: ${origin}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

export async function signSiwe(address: Address): Promise<boolean> {
	const chainId = getChainId(wagmiConfig);
	const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
	const message = buildSiweMessage(address, nonce, chainId);
	const signature = (await signMessage(wagmiConfig, { message })) as Hex;
	return verifyMessage({ address, message, signature });
}

export async function readNftBalance(
	contractAddress: Address,
	walletAddress: Address
): Promise<bigint> {
	if (contractAddress === '0x0000000000000000000000000000000000000000') return 0n;
	const balance = await mainnetPublic.readContract({
		address: contractAddress,
		abi: erc721Abi,
		functionName: 'balanceOf',
		args: [walletAddress]
	});
	return balance as bigint;
}

// Returns the unique set of vault wallets that have delegated to `walletAddress`
// with general rights (bytes32(0)) for any of the provided NFT contracts, or
// for everything (ALL type). Lets cold-wallet holders verify via delegate.xyz
// without moving NFTs.
export async function getDelegatedVaults(
	walletAddress: Address,
	relevantContracts: Address[]
): Promise<Address[]> {
	const lowerFilter = new Set(relevantContracts.map((c) => c.toLowerCase()));
	try {
		const delegations = (await mainnetPublic.readContract({
			address: DELEGATE_REGISTRY_V2,
			abi: delegateRegistryAbi,
			functionName: 'getIncomingDelegations',
			args: [walletAddress]
		})) as RawDelegation[];

		const vaults = new Set<Address>();
		for (const d of delegations) {
			if (d.rights !== EMPTY_RIGHTS) continue;
			const isAllType = d.type_ === 1;
			const isContractOrToken =
				(d.type_ === 2 || d.type_ === 3) &&
				lowerFilter.has(d.contract_.toLowerCase());
			if (isAllType || isContractOrToken) {
				vaults.add(d.from);
			}
		}
		return [...vaults];
	} catch (err) {
		console.warn('[web3] delegate.xyz lookup failed', err);
		return [];
	}
}

export async function getEthUsdPrice(): Promise<number> {
	const res = await fetch(
		'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
	);
	if (!res.ok) throw new Error(`Price API returned ${res.status}`);
	const data = (await res.json()) as { ethereum?: { usd?: number } };
	const price = data?.ethereum?.usd;
	if (typeof price !== 'number') throw new Error('Unexpected price API response');
	return price;
}

export function usdToEthString(usd: number, ethUsd: number): string {
	return (usd / ethUsd).toFixed(6);
}

export async function sendPayment(
	chainKey: SupportedChain,
	receiver: Address,
	amountEth: string
): Promise<Hex> {
	const targetChainId = chainKey === 'mainnet' ? mainnet.id : base.id;
	if (getChainId(wagmiConfig) !== targetChainId) {
		await switchChain(wagmiConfig, { chainId: targetChainId });
	}
	return sendTransaction(wagmiConfig, {
		to: receiver,
		value: parseEther(amountEth),
		chainId: targetChainId
	});
}
