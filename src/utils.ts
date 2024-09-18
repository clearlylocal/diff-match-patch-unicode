import { Diff, DiffOperation } from './Diff.ts'
import { assert } from '@std/assert/assert'

/**
 * A `Diff` or a tuple of `[operation, text]` (loosely typed for convenience as an input to `makeDiff`).
 */
export type DiffLike = Diff | (number | string)[]

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
	assert(typeof text === 'string')
	assert(op === DiffOperation.Delete || op === DiffOperation.Insert || op === DiffOperation.Equal)
	return new Diff(op, text)
}
