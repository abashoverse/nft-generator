import type {
	Layer,
	Trait,
	IncompatibleRule,
	CollectionConfig,
	Combination
} from '$lib/types';
import { debugStore } from './debug.svelte';

function createGeneratorStore() {
	let layers = $state<Layer[]>([]);
	let incompatibleRules = $state<IncompatibleRule[]>([]);
	let collection = $state<Combination[]>([]);
	let config = $state<CollectionConfig>({
		name: '',
		description: '',
		size: 10,
		usePreReveal: false,
		preRevealImage: null,
		preRevealAnimation: null,
		soulbound: false
	});

	function updateConfig(updates: Partial<CollectionConfig>) {
		config = { ...config, ...updates };
		debugStore.log(1, `config updated: ${Object.keys(updates).join(', ')}`, 'info', updates);
	}

	function setLayers(next: Layer[]) {
		layers = next;
		debugStore.log(
			2,
			`layers set (${next.length} layers, ${next.reduce((a, l) => a + l.traits.length, 0)} traits)`,
			'info'
		);
	}

	function addIncompatibleRule(rule: IncompatibleRule) {
		incompatibleRules = [...incompatibleRules, rule];
		debugStore.log(2, `rule added: ${rule.traitA} ↔ ${rule.traitB}`, 'info');
	}

	function removeIncompatibleRule(index: number) {
		const removed = incompatibleRules[index];
		incompatibleRules = incompatibleRules.filter((_, i) => i !== index);
		debugStore.log(2, `rule removed: ${removed?.traitA} ↔ ${removed?.traitB}`, 'info');
	}

	function setCollection(next: Combination[]) {
		collection = next;
	}

	function pickWeighted(traits: Trait[]): Trait {
		const total = traits.reduce((a, b) => a + Number(b.weight), 0);
		let r = Math.random() * total;
		for (const t of traits) {
			r -= t.weight;
			if (r <= 0) return t;
		}
		return traits[0];
	}

	function isValidCombo(combo: string[], rules: IncompatibleRule[]) {
		return !rules.some((rule) => combo.includes(rule.traitA) && combo.includes(rule.traitB));
	}

	function generateRandomCombo(): string[] {
		let attempts = 0;
		const maxAttempts = 1000;
		while (attempts < maxAttempts) {
			const selected = layers.map((layer) => pickWeighted(layer.traits).file.name);
			if (isValidCombo(selected, incompatibleRules)) return selected;
			attempts++;
		}
		debugStore.log(
			3,
			`hit max attempts (${maxAttempts}) finding a valid combo; falling back to first traits`,
			'warn'
		);
		return layers.map((layer) => layer.traits[0].file.name);
	}

	async function drawCombo(combo: string[], canvas: HTMLCanvasElement, size: number = 300) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, size, size);
		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const traitName = combo[i];
			const trait = layer.traits.find((t) => t.file.name === traitName);
			if (trait) {
				const img = await createImageBitmap(trait.file);
				ctx.drawImage(img, 0, 0, size, size);
			}
		}
	}

	async function generatePreview(canvas: HTMLCanvasElement) {
		if (layers.length === 0) return;
		const combo = generateRandomCombo();
		await drawCombo(combo, canvas);
	}

	return {
		get layers() {
			return layers;
		},
		get incompatibleRules() {
			return incompatibleRules;
		},
		get collection() {
			return collection;
		},
		get config() {
			return config;
		},
		setLayers,
		setCollection,
		updateConfig,
		addIncompatibleRule,
		removeIncompatibleRule,
		generateRandomCombo,
		drawCombo,
		generatePreview
	};
}

export const generator = createGeneratorStore();
export type GeneratorStore = ReturnType<typeof createGeneratorStore>;
