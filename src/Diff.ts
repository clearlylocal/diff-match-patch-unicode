export type DiffOperation = typeof DiffOperation[keyof typeof DiffOperation]

/**
 * The data structure representing a diff is an array of tuples:
 * [[DiffOperation.Delete, 'Hello'], [DiffOperation.Insert, 'Goodbye'], [DiffOperation.Equal, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 *
 * @enum
 */
export const DiffOperation = {
	Delete: -1,
	Insert: 1,
	Equal: 0,
} as const

/** Diff tuple of [operation, text] */
export class Diff {
	0: DiffOperation
	1: string

	/**
	 * @param op - One of {@linkcode DiffOperation.Delete}, {@linkcode DiffOperation.Insert}, or
	 * {@linkcode DiffOperation.Equal}
	 * @param text - Text to be deleted, inserted, or retained
	 */
	constructor(op: DiffOperation, text: string) {
		this[0] = op
		this[1] = text
	}

	get op() {
		return this[0]
	}
	get text() {
		return this[1]
	}
	get length() {
		return 2
	}

	toJSON() {
		return [...this]
	}

	*[Symbol.iterator]() {
		yield this[0]
		yield this[1]
	}

	// @ts-expect-error A computed property name in a class property declaration must have a simple literal type or a 'unique symbol' type.
	[Symbol.for('Deno.customInspect')] = this.#customInspect;
	// @ts-expect-error A computed property name in a class property declaration must have a simple literal type or a 'unique symbol' type.
	[Symbol.for('nodejs.util.inspect.custom')] = this.#customInspect

	#customInspect(this: Diff, _: unknown, opts: { colors: boolean }) {
		return `Diff #${(globalThis.Deno?.inspect([...this], opts) ??
			// @ts-expect-error Node types
			globalThis.util?.inspect([...this], opts) ??
			JSON.stringify(this))}`
	}

	clone() {
		return new Diff(this[0], this[1])
	}
}
