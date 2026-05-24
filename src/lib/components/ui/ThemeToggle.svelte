<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import IconButton from './IconButton.svelte';
</script>

<IconButton onclick={themeStore.toggle} ariaLabel="Toggle theme">
	{#if themeStore.isDark}
		<Sun class="h-5 w-5" />
	{:else}
		<Moon class="h-5 w-5" />
	{/if}
</IconButton>
