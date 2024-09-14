/**
 * Types of diff operations.
 * @enum
 */
export const DiffOperation = {
	Delete: -1,
	Insert: 1,
	Equal: 0,
} as const
export type DiffOperation = typeof DiffOperation[keyof typeof DiffOperation]

/**
 * Diff tuple of `[operation, text]`.
 *
 * The data structure representing a diff is an array of `Diff` tuples.
 *
 * @example
 * ```ts
 * [[-1, 'Hello'], [1, 'Goodbye'], [0, ' world.']]
 * // delete 'Hello', add 'Goodbye' and keep ' world.'
 * ```
 */
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

	get op(): DiffOperation {
		return this[0]
	}
	get text(): string {
		return this[1]
	}
	get length(): 2 {
		return 2
	}

	toJSON(): [DiffOperation, string] {
		return [this[0], this[1]]
	}

	*[Symbol.iterator](): DiffTupleIter {
		yield this[0]
		yield this[1]
	}

	// @ts-expect-error A computed property name in a class property declaration must have a simple literal type or a 'unique symbol' type.
	[Symbol.for('Deno.customInspect')]: CustomInspect = this.#customInspect;
	// @ts-expect-error A computed property name in a class property declaration must have a simple literal type or a 'unique symbol' type.
	[Symbol.for('nodejs.util.inspect.custom')]: CustomInspect = this.#customInspect

	#customInspect(this: Diff, _: unknown, opts: { colors: boolean }) {
		return `Diff #${(globalThis.Deno?.inspect([...this], opts) ??
			// @ts-expect-error Node types
			globalThis.util?.inspect([...this], opts) ??
			JSON.stringify(this))}`
	}

	clone(): Diff {
		return new Diff(this[0], this[1])
	}
}

type CustomInspect = (this: Diff, _: unknown, opts: { colors: boolean }) => string
/**
 * Actually always yields a single DiffOperation then a single string, but TS currently can't express that in an
 * iterator type.
 */
type DiffTupleIter = Iterator<DiffOperation | string, undefined, undefined>
