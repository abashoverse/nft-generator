import type { CollectionConfig, IncompatibleRule, Layer, Trait } from '$lib/types';
import { uid } from '$lib/id';

export const CONFIG_TYPE = 'nft-generator-config';
export const CONFIG_VERSION = 1;

// Reserved trait key for the optional "None" trait (file === null). A real
// trait key is its original filename, which always has an image extension, so
// this sentinel can never collide with one.
const NONE_KEY = '@none';

// The File-bearing fields of CollectionConfig can't go in JSON, so only the
// plain settings travel with the config file.
type CollectionSettings = Pick<
	CollectionConfig,
	'name' | 'description' | 'size' | 'exportSize' | 'usePreReveal' | 'soulbound'
>;

interface ConfigTrait {
	file: string; // original filename, the stable match key
	name: string;
	weight: number;
}

interface ConfigLayer {
	name: string;
	allowNone: boolean;
	none?: { name: string; weight: number };
	traits: ConfigTrait[];
}

interface ConfigRuleEntry {
	layer: number; // index into layers[]
	traits: string[]; // filename keys, or NONE_KEY
}

interface ConfigRule {
	conditions: ConfigRuleEntry[];
	blocks: ConfigRuleEntry[];
}

export interface ProjectConfig {
	type: typeof CONFIG_TYPE;
	version: number;
	collection: CollectionSettings;
	layers: ConfigLayer[];
	rules: ConfigRule[];
}

function traitKey(trait: Trait): string {
	return trait.file ? trait.file.name : NONE_KEY;
}

/** Snapshot the current state into a plain JSON-serializable config. */
export function serializeProject(
	config: CollectionConfig,
	layers: Layer[],
	rules: IncompatibleRule[]
): ProjectConfig {
	const layerIndexById = new Map(layers.map((l, i) => [l.id, i]));
	const traitKeyById = new Map<string, string>();
	for (const layer of layers) {
		for (const t of layer.traits) traitKeyById.set(t.id, traitKey(t));
	}

	const outLayers: ConfigLayer[] = layers.map((layer) => {
		const none = layer.traits.find((t) => t.file === null);
		const real = layer.traits.filter((t) => t.file !== null);
		return {
			name: layer.name,
			allowNone: !!none,
			...(none ? { none: { name: none.name, weight: none.weight } } : {}),
			traits: real.map((t) => ({
				file: (t.file as File).name,
				name: t.name,
				weight: t.weight
			}))
		};
	});

	const mapEntry = (e: { layerId: string; traitIds: string[] }): ConfigRuleEntry | null => {
		const layer = layerIndexById.get(e.layerId);
		if (layer === undefined) return null;
		const traits = e.traitIds
			.map((id) => traitKeyById.get(id))
			.filter((k): k is string => k !== undefined);
		if (traits.length === 0) return null;
		return { layer, traits };
	};

	const outRules: ConfigRule[] = [];
	for (const rule of rules) {
		const conditions = rule.conditions.map(mapEntry);
		const blocks = rule.blocks.map(mapEntry);
		if (conditions.some((c) => !c) || blocks.some((b) => !b)) continue;
		outRules.push({
			conditions: conditions as ConfigRuleEntry[],
			blocks: blocks as ConfigRuleEntry[]
		});
	}

	return {
		type: CONFIG_TYPE,
		version: CONFIG_VERSION,
		collection: {
			name: config.name,
			description: config.description,
			size: config.size,
			exportSize: config.exportSize,
			usePreReveal: config.usePreReveal,
			soulbound: config.soulbound
		},
		layers: outLayers,
		rules: outRules
	};
}

/** Parse + shape-check an uploaded file. Throws a user-readable error. */
export function parseProjectConfig(text: string): ProjectConfig {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('That file is not valid JSON.');
	}
	const obj = data as Partial<ProjectConfig>;
	if (!obj || typeof obj !== 'object' || obj.type !== CONFIG_TYPE || !Array.isArray(obj.layers)) {
		throw new Error("This doesn't look like a generator config file.");
	}
	return data as ProjectConfig;
}

export interface ApplyReport {
	layersMatched: number;
	layersInConfig: number;
	layersAdded: number; // current layers not described by the config, kept as-is
	layersMissing: string[]; // config layers with no match in the current upload
	traitsApplied: number;
	traitsMissing: number; // config traits whose file wasn't in the upload
	rulesRestored: number;
	rulesDropped: number;
	noImages: boolean;
}

export interface ApplyResult {
	layers: Layer[];
	rules: IncompatibleRule[];
	collection: Partial<CollectionSettings>;
	report: ApplyReport;
}

/**
 * Reattach a parsed config onto the currently uploaded layers. Layers are
 * matched by their set of real filenames (survives layer/trait renames and
 * reordering); within a layer, traits are matched by filename. Anything that
 * can't be resolved is dropped and counted in the report rather than throwing.
 */
export function applyProjectConfig(cfg: ProjectConfig, current: Layer[]): ApplyResult {
	const report: ApplyReport = {
		layersMatched: 0,
		layersInConfig: cfg.layers.length,
		layersAdded: 0,
		layersMissing: [],
		traitsApplied: 0,
		traitsMissing: 0,
		rulesRestored: 0,
		rulesDropped: 0,
		noImages: current.length === 0
	};

	const currentEntries = current.map((layer) => ({
		layer,
		files: new Set(layer.traits.filter((t) => t.file).map((t) => (t.file as File).name)),
		used: false
	}));

	const builtByConfigIndex: (Layer | undefined)[] = new Array(cfg.layers.length);

	// Match each saved layer to an uploaded one by how many filenames they share,
	// with an exact name match as a tiebreak/fallback. This tolerates renames,
	// reordering, and traits being added or removed since the config was saved.
	// A saved layer that shares nothing and matches no name is left out; an
	// uploaded layer the config never mentions is kept (handled below).
	cfg.layers.forEach((cl, ci) => {
		const wanted = cl.traits.map((t) => t.file);
		const name = cl.name.toLowerCase();

		let match: (typeof currentEntries)[number] | null = null;
		let bestScore = 0;
		for (const c of currentEntries) {
			if (c.used) continue;
			let overlap = 0;
			for (const f of wanted) if (c.files.has(f)) overlap++;
			const score = overlap + (c.layer.name.toLowerCase() === name ? 0.5 : 0);
			if (score > bestScore) {
				bestScore = score;
				match = c;
			}
		}
		if (!match) {
			report.layersMissing.push(cl.name);
			return;
		}
		match.used = true;
		report.layersMatched++;

		const fileToTrait = new Map<string, Trait>(
			match.layer.traits.filter((t) => t.file).map((t) => [(t.file as File).name, t])
		);
		const traits: Trait[] = [];

		// None trait first, mirroring how setLayerAllowNone prepends it.
		if (cl.allowNone) {
			traits.push({
				id: uid('trait'),
				name: cl.none?.name ?? 'None',
				file: null,
				weight: cl.none?.weight ?? 0
			});
		}

		// Real traits in the config's order, reattached to the uploaded File.
		const usedFiles = new Set<string>();
		for (const ct of cl.traits) {
			const src = fileToTrait.get(ct.file);
			if (!src || !src.file) {
				report.traitsMissing++;
				continue;
			}
			usedFiles.add(ct.file);
			traits.push({
				id: uid('trait'),
				name: ct.name,
				file: src.file,
				weight: ct.weight,
				width: src.width,
				height: src.height
			});
			report.traitsApplied++;
		}

		// Files in the upload but not in the config (newly added art) are kept so
		// they aren't silently lost.
		for (const [fname, src] of fileToTrait) {
			if (usedFiles.has(fname)) continue;
			traits.push({ ...src, id: uid('trait') });
		}

		builtByConfigIndex[ci] = {
			id: uid('layer'),
			name: cl.name,
			allowNone: cl.allowNone,
			traits
		};
	});

	const layers: Layer[] = [];
	for (const built of builtByConfigIndex) {
		if (built) layers.push(built);
	}
	// Uploaded layers the config never mentioned keep their place at the end.
	for (const c of currentEntries) {
		if (c.used) continue;
		report.layersAdded++;
		layers.push(c.layer);
	}

	// Rebuild rules against the freshly minted ids, dropping any that no longer
	// fully resolve.
	const lookupByConfigIndex = builtByConfigIndex.map((built) => {
		if (!built) return null;
		const map = new Map<string, string>();
		for (const t of built.traits) map.set(t.file ? t.file.name : NONE_KEY, t.id);
		return { layerId: built.id, map };
	});

	const resolveEntry = (e: ConfigRuleEntry): { layerId: string; traitIds: string[] } | null => {
		const lk = lookupByConfigIndex[e.layer];
		if (!lk) return null;
		const traitIds: string[] = [];
		for (const key of e.traits) {
			const id = lk.map.get(key);
			if (!id) return null;
			traitIds.push(id);
		}
		if (traitIds.length === 0) return null;
		return { layerId: lk.layerId, traitIds };
	};

	const rules: IncompatibleRule[] = [];
	for (const r of cfg.rules ?? []) {
		const conditions = r.conditions.map(resolveEntry);
		const blocks = r.blocks.map(resolveEntry);
		if (
			conditions.length === 0 ||
			blocks.length === 0 ||
			conditions.some((c) => !c) ||
			blocks.some((b) => !b)
		) {
			report.rulesDropped++;
			continue;
		}
		rules.push({
			conditions: conditions as IncompatibleRule['conditions'],
			blocks: blocks as IncompatibleRule['blocks']
		});
		report.rulesRestored++;
	}

	return { layers, rules, collection: cfg.collection ?? {}, report };
}
