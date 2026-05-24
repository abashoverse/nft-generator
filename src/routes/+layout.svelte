<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { themeStore } from '$lib/stores/theme.svelte';

	let { children } = $props();

	onMount(() => {
		themeStore.init();
	});
</script>

{@render children()}
