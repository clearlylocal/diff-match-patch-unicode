import { assert } from '@std/assert/assert'
import { Diff, type DiffOperation } from './Diff.ts'

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
	return new Diff(getOpWithAssertion(op), text)
}

function getOpWithAssertion(op: unknown): DiffOperation {
	assert(op === -1 || op === 0 || op === 1)
	return op
}
