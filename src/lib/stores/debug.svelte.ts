import type { DebugEvent } from '$lib/types';

const MAX_EVENTS = 200;

function createDebugStore() {
	let events = $state<DebugEvent[]>([]);
	let enabled = $state(true);
	let nextId = 0;

	function log(step: number, message: string, level: DebugEvent['level'] = 'info', data?: unknown) {
		if (!enabled) return;
		const evt: DebugEvent = { id: nextId++, ts: Date.now(), step, level, message, data };
		events = [evt, ...events].slice(0, MAX_EVENTS);
		const tag = `[step ${step}] ${level.toUpperCase()}`;
		if (data !== undefined) {
			console.log(tag, message, data);
		} else {
			console.log(tag, message);
		}
	}

	function clear() {
		events = [];
	}

	function forStep(step: number) {
		return events.filter((e) => e.step === step);
	}

	return {
		get events() {
			return events;
		},
		get enabled() {
			return enabled;
		},
		set enabled(v: boolean) {
			enabled = v;
		},
		log,
		clear,
		forStep
	};
}

export const debugStore = createDebugStore();
