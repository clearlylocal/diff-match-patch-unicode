import { assertEquals } from '@std/assert/equals'
import { DiffLike, makeDiffs } from '../src/utils.ts'

export function assertDiffsEqual(d1: readonly DiffLike[], d2: readonly DiffLike[]) {
	assertEquals(makeDiffs(d1), makeDiffs(d2))
}

export function assertDiffsEqual2d(d1: readonly DiffLike[][], d2: readonly DiffLike[][]) {
	assertEquals(d1.map((x) => makeDiffs(x)), d2.map((x) => makeDiffs(x)))
}
