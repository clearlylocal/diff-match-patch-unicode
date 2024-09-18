import { assertEquals } from '@std/assert/equals'
import { DiffLike, makeDiffs } from './utils.ts'

export function assertDiffsEqual(actual: readonly DiffLike[], expected: readonly DiffLike[]) {
	assertEquals(makeDiffs(actual), makeDiffs(expected))
}

export function assertDiffsEqual2d(actual: readonly DiffLike[][], expected: readonly DiffLike[][]) {
	assertEquals(actual.map(makeDiffs), expected.map(makeDiffs))
}
