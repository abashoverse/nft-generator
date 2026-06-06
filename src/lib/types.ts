export interface Trait {
	id: string;
	name: string;
	file: File | null;
	weight: number;
	width?: number;
	height?: number;
}

export interface Layer {
	id: string;
	name: string;
	traits: Trait[];
	allowNone?: boolean;
}

export interface IncompatibleRule {
	conditions: {
		layerId: string;
		traitIds: string[];
	}[];
	blockedLayerId: string;
	blockedTraitId: string;
}

export interface CollectionConfig {
	name: string;
	description: string;
	size: number;
	exportSize: number;
	usePreReveal: boolean;
	preRevealImage: File | null;
	preRevealAnimation: File | null;
	soulbound: boolean;
}

export type Combination = string[];

export interface Metadata {
	name: string;
	description: string;
	image: string;
	attributes: {
		trait_type: string;
		value: string;
	}[];
	soulbound?: boolean;
}
