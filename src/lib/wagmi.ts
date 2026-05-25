import { createConfig, createStorage, noopStorage } from '@wagmi/core';
import { injected } from '@wagmi/connectors';
import { fallback, http } from 'viem';
import { mainnet, base } from 'viem/chains';

// viem's default RPC (eth.merkle.io) is rate-limited and frequently CORS-fails
// in browsers. These public endpoints support CORS and degrade gracefully via
// fallback() if one of them is down.
export const mainnetTransport = fallback([
	http('https://eth.llamarpc.com'),
	http('https://cloudflare-eth.com'),
	http('https://ethereum-rpc.publicnode.com')
]);

export const baseTransport = fallback([
	http('https://mainnet.base.org'),
	http('https://base-rpc.publicnode.com'),
	http('https://base.llamarpc.com')
]);

export const injectedConnector = injected();

export const wagmiConfig = createConfig({
	chains: [mainnet, base],
	transports: {
		[mainnet.id]: mainnetTransport,
		[base.id]: baseTransport
	},
	connectors: [injectedConnector],
	// noopStorage = nothing persists; every page load is a fresh session and
	// wagmi will not auto-reconnect the wallet.
	storage: createStorage({ storage: noopStorage })
});
