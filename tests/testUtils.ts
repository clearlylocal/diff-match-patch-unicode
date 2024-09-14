import { assertEquals } from '@std/assert'
import { Diff, DiffOperation } from '../src/Diff.ts'

type DiffLike = Diff | [DiffOperation, string]

export function makeDiffs(arr: DiffLike[]) {
	// https://github.com/microsoft/TypeScript/issues/42033
	return arr.map(({ 0: op, 1: text }) => new Diff(op, text))
}

export function assertDiffsEqual(d1: DiffLike[], d2: DiffLike[]) {
	assertEquals(makeDiffs(d1), makeDiffs(d2))
}

export function assertDiffsEqual2d(d1: DiffLike[][], d2: DiffLike[][]) {
	assertEquals(d1.map((x) => makeDiffs(x)), d2.map((x) => makeDiffs(x)))
}
