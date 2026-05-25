<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { PUBLIC_UMAMI_SCRIPT_URL, PUBLIC_UMAMI_WEBSITE_ID } from '$env/static/public';

	const umamiUrl = PUBLIC_UMAMI_SCRIPT_URL || undefined;
	const umamiId = PUBLIC_UMAMI_WEBSITE_ID || undefined;

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
