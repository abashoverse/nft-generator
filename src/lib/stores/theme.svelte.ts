function createThemeStore() {
	let isDark = $state(false);

	function apply(dark: boolean) {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('dark', dark);
	}

	function init() {
		if (typeof window === 'undefined') return;
		const stored = localStorage.getItem('theme');
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const dark = stored ? stored === 'dark' : prefersDark;
		isDark = dark;
		apply(dark);
	}

	function toggle() {
		isDark = !isDark;
		apply(isDark);
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', isDark ? 'dark' : 'light');
		}
	}

	function set(value: 'light' | 'dark') {
		isDark = value === 'dark';
		apply(isDark);
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', value);
		}
	}

	return {
		get isDark() {
			return isDark;
		},
		init,
		toggle,
		set
	};
}

export const themeStore = createThemeStore();
