import {
	createPublicClient,
	createWalletClient,
	custom,
	http,
	parseEther,
	verifyMessage,
	type Address,
	type Chain,
	type Hex
} from 'viem';
import { mainnet, base } from 'viem/chains';

export type SupportedChain = 'mainnet' | 'base';

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

// Empty rights (bytes32(0)) means the delegator granted general / all rights.
const EMPTY_RIGHTS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Delegation type enum from the V2 registry:
// 0 NONE, 1 ALL, 2 CONTRACT, 3 ERC721, 4 ERC20, 5 ERC1155
interface RawDelegation {
	type_: number;
	to: Address;
	from: Address;
	rights: `0x${string}`;
	contract_: Address;
	tokenId: bigint;
	amount: bigint;
}

function chainFor(key: SupportedChain): Chain {
	return key === 'mainnet' ? mainnet : base;
}

function getProvider(): {
	request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
} | null {
	if (typeof window === 'undefined') return null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ((window as any).ethereum as ReturnType<typeof getProvider>) ?? null;
}

const mainnetPublic = createPublicClient({
	chain: mainnet,
	transport: http()
});

export async function connectWallet(): Promise<Address | null> {
	const provider = getProvider();
	if (!provider) {
		throw new Error('No Ethereum wallet detected. Install MetaMask or another EVM wallet.');
	}
	const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
	return (accounts[0] as Address) ?? null;
}

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
	const provider = getProvider();
	if (!provider) throw new Error('No wallet.');
	const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
	const chainId = parseInt(chainIdHex, 16);
	const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
	const message = buildSiweMessage(address, nonce, chainId);
	const signature = (await provider.request({
		method: 'personal_sign',
		params: [message, address]
	})) as Hex;
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
// for everything (ALL type). Used to let cold-wallet holders verify via
// delegate.xyz without moving NFTs.
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

async function ensureChain(chainKey: SupportedChain): Promise<void> {
	const provider = getProvider();
	if (!provider) throw new Error('No wallet.');
	const target = chainFor(chainKey);
	const currentHex = (await provider.request({ method: 'eth_chainId' })) as string;
	if (parseInt(currentHex, 16) === target.id) return;

	try {
		await provider.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: `0x${target.id.toString(16)}` }]
		});
	} catch (err) {
		// 4902 = chain not added to wallet; only add Base, mainnet is always present.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((err as any)?.code === 4902 && chainKey === 'base') {
			await provider.request({
				method: 'wallet_addEthereumChain',
				params: [
					{
						chainId: `0x${base.id.toString(16)}`,
						chainName: base.name,
						nativeCurrency: base.nativeCurrency,
						rpcUrls: ['https://mainnet.base.org'],
						blockExplorerUrls: ['https://basescan.org']
					}
				]
			});
		} else {
			throw err;
		}
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
	const provider = getProvider();
	if (!provider) throw new Error('No wallet.');

	await ensureChain(chainKey);

	const walletClient = createWalletClient({
		chain: chainFor(chainKey),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		transport: custom(provider as any)
	});
	const [account] = await walletClient.requestAddresses();
	return walletClient.sendTransaction({
		account,
		to: receiver,
		value: parseEther(amountEth)
	});
}
