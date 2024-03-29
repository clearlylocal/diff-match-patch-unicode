// @ts-check

/**
 * The data structure representing a diff is an array of tuples:
 * [[DiffOperation.Delete, 'Hello'], [DiffOperation.Insert, 'Goodbye'], [DiffOperation.Equal, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 *
 * @enum {typeof DiffOperation[keyof typeof DiffOperation]}
 */
export const DiffOperation = /** @type {const} */ ({
	Delete: -1,
	Insert: 1,
	Equal: 0,
})

/** Diff tuple of [operation, text] */
export class Diff {
	/**
	 * @param {DiffOperation} op - One of {@linkcode DiffOperation.Delete}, {@linkcode DiffOperation.Insert}, or
	 * {@linkcode DiffOperation.Equal}
	 * @param {string} text - Text to be deleted, inserted, or retained
	 */
	constructor(op, text) {
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

	[Symbol.for('Deno.customInspect')]() {
		return `Diff #${(globalThis.Deno?.inspect([...this], { colors: true }) ?? JSON.stringify(this))}`
	}

	clone() {
		return new Diff(this[0], this[1])
	}
}
