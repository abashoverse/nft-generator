<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { env } from '$env/dynamic/public';

	const umamiUrl = env.PUBLIC_UMAMI_SCRIPT_URL || undefined;
	const umamiId = env.PUBLIC_UMAMI_WEBSITE_ID || undefined;

	let { children } = $props();

	onMount(() => {
		themeStore.init();
	});
</script>

<svelte:head>
	{#if umamiUrl && umamiId}
		<script defer src={umamiUrl} data-website-id={umamiId}></script>
	{/if}
</svelte:head>

{@render children()}
