let counter = 0;

/** Session-stable unique id. Layers and traits are recreated each upload, so
 *  ids only need to be unique within a session, not persisted. */
export function uid(prefix = 'id'): string {
	counter += 1;
	return `${prefix}_${counter}`;
}
