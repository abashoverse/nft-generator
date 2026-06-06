import type {
	Layer,
	Trait,
	IncompatibleRule,
	CollectionConfig,
	Combination
} from '$lib/types';
import { uid } from '$lib/id';

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

	// Decoded traits are reused across every image instead of re-decoding the
	// same file once per NFT. Cleared whenever the layer set changes.
	const bitmapCache = new Map<File, ImageBitmap>();

	function clearBitmapCache() {
		for (const bmp of bitmapCache.values()) bmp.close();
		bitmapCache.clear();
	}

	function updateConfig(updates: Partial<CollectionConfig>) {
		config = { ...config, ...updates };
	}

	function setLayers(next: Layer[]) {
		clearBitmapCache();
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

	function renameLayer(layerId: string, name: string) {
		layers = layers.map((l) => (l.id === layerId ? { ...l, name } : l));
	}

	function renameTrait(layerId: string, traitId: string, name: string) {
		layers = layers.map((l) =>
			l.id === layerId
				? { ...l, traits: l.traits.map((t) => (t.id === traitId ? { ...t, name } : t)) }
				: l
		);
	}

	function moveLayer(from: number, to: number) {
		if (to < 0 || to >= layers.length || from === to) return;
		const next = [...layers];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		layers = next;
	}

	function pruneRules() {
		const byId = new Map(layers.map((l) => [l.id, l]));
		incompatibleRules = incompatibleRules.filter((rule) => {
			const condsOk = rule.conditions.every((c) => {
				const layer = byId.get(c.layerId);
				return !!layer && c.traitIds.every((tid) => layer.traits.some((t) => t.id === tid));
			});
			const blockLayer = byId.get(rule.blockedLayerId);
			const blockOk = !!blockLayer && blockLayer.traits.some((t) => t.id === rule.blockedTraitId);
			return condsOk && blockOk;
		});
	}

	function setLayerAllowNone(layerId: string, allow: boolean) {
		layers = layers.map((l) => {
			if (l.id !== layerId) return l;
			const hasNone = l.traits.some((t) => t.file === null);
			if (allow && !hasNone) {
				const sum = l.traits.reduce((a, t) => a + t.weight, 0);
				const avg = l.traits.length > 0 ? sum / l.traits.length : 100;
				const none: Trait = {
					id: uid('trait'),
					name: 'None',
					file: null,
					weight: Math.round(avg * 1000) / 1000
				};
				return { ...l, allowNone: true, traits: [none, ...l.traits] };
			}
			if (!allow && hasNone) {
				return { ...l, allowNone: false, traits: l.traits.filter((t) => t.file !== null) };
			}
			return { ...l, allowNone: allow };
		});
		// A removed "none" trait may have been referenced by a rule.
		if (!allow) pruneRules();
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
				const layerIdx = layers.findIndex((l) => l.id === cond.layerId);
				if (layerIdx === -1) return false;
				return cond.traitIds.includes(combo[layerIdx]);
			});
			if (!allConditionsMatch) return false;
			const blockedIdx = layers.findIndex((l) => l.id === rule.blockedLayerId);
			if (blockedIdx === -1) return false;
			return combo[blockedIdx] === rule.blockedTraitId;
		});
	}

	function generateRandomCombo(): string[] {
		let attempts = 0;
		const maxAttempts = 1000;
		while (attempts < maxAttempts) {
			const selected = layers.map((layer) => pickWeighted(layer.traits).id);
			if (isValidCombo(selected, incompatibleRules)) return selected;
			attempts++;
		}
		return layers.map((layer) => layer.traits[0].id);
	}

	async function drawCombo(combo: string[], canvas: HTMLCanvasElement, size: number = 300) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, size, size);
		for (let i = layers.length - 1; i >= 0; i--) {
			const trait = layers[i].traits.find((t) => t.id === combo[i]);
			if (!trait || !trait.file) continue;
			let img = bitmapCache.get(trait.file);
			if (!img) {
				img = await createImageBitmap(trait.file);
				bitmapCache.set(trait.file, img);
			}
			ctx.drawImage(img, 0, 0, size, size);
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
		renameLayer,
		renameTrait,
		moveLayer,
		setLayerAllowNone,
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
