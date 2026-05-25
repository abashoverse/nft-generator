import type {
	Layer,
	Trait,
	IncompatibleRule,
	CollectionConfig,
	Combination
} from '$lib/types';

function createGeneratorStore() {
	let layers = $state<Layer[]>([]);
	let incompatibleRules = $state<IncompatibleRule[]>([]);
	let collection = $state<Combination[]>([]);
	let config = $state<CollectionConfig>({
		name: '',
		description: '',
		size: 10,
		exportSize: 1000,
		usePreReveal: false,
		preRevealImage: null,
		preRevealAnimation: null,
		soulbound: false
	});

	function updateConfig(updates: Partial<CollectionConfig>) {
		config = { ...config, ...updates };
	}

	function setLayers(next: Layer[]) {
		layers = next;
	}

	function addIncompatibleRule(rule: IncompatibleRule) {
		incompatibleRules = [...incompatibleRules, rule];
	}

	function removeIncompatibleRule(index: number) {
		incompatibleRules = incompatibleRules.filter((_, i) => i !== index);
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
		return !rules.some((rule) => {
			const allConditionsMatch = rule.conditions.every((cond) => {
				const layerIdx = layers.findIndex((l) => l.name === cond.layerName);
				if (layerIdx === -1) return false;
				return cond.traitNames.includes(combo[layerIdx]);
			});
			if (!allConditionsMatch) return false;
			const blockedIdx = layers.findIndex((l) => l.name === rule.blockedLayer);
			if (blockedIdx === -1) return false;
			return combo[blockedIdx] === rule.blockedTrait;
		});
	}

	function generateRandomCombo(): string[] {
		let attempts = 0;
		const maxAttempts = 1000;
		while (attempts < maxAttempts) {
			const selected = layers.map((layer) => pickWeighted(layer.traits).file.name);
			if (isValidCombo(selected, incompatibleRules)) return selected;
			attempts++;
		}
		return layers.map((layer) => layer.traits[0].file.name);
	}

	async function drawCombo(combo: string[], canvas: HTMLCanvasElement, size: number = 300) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, size, size);
		for (let i = layers.length - 1; i >= 0; i--) {
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
		await drawCombo(combo, canvas, canvas.width);
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
