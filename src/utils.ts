import { Diff } from './Diff.ts'
import { assert } from '@std/assert/assert'

/**
 * A `Diff` or a tuple of `[operation, text]` (loosely typed for convenience as an input to `makeDiff`).
 */
export type DiffLike = Diff | readonly (number | string)[]

/**
 * Converts an array of `DiffLike`s to an array of `Diff`s.
 */
export function makeDiffs(arr: readonly DiffLike[]): Diff[] {
	return arr.map(makeDiff)
}

/**
 * Converts a `DiffLike` to a `Diff`.
 */
export function makeDiff(d: DiffLike): Diff {
	if (d instanceof Diff) return d
	const [op, text] = d
	assert(typeof text === 'string', `Invalid text: type is ${typeof text}; expected string`)
	assert(op === -1 || op === 0 || op === 1, `Invalid op: ${op}; expected -1, 0, or 1`)
	return new Diff(op, text)
}
