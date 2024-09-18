import { assert, assertInstanceOf, assertThrows } from '@std/assert'
import { makeDiff } from './utils.ts'
import { Diff } from './Diff.ts'

Deno.test(makeDiff.name, async (t) => {
	await t.step('instanceof', () => {
		assertInstanceOf(makeDiff([0, 'a']), Diff)
	})

	await t.step('returns `Diff` input unchanged', () => {
		const diff = makeDiff([0, 'a'])
		// reference-equal
		assert(diff === diff)
	})

	await t.step('validates inputs at runtime', () => {
		makeDiff([0, 'a'])
		makeDiff([1, 'a'])
		makeDiff([-1, 'a'])

		assertThrows(() => makeDiff([1, 1]), Error, 'Invalid text')
		assertThrows(() => makeDiff(['a', '1']), Error, 'Invalid op')
		assertThrows(() => makeDiff(['a', 1]), Error, 'Invalid text')
		assertThrows(() => makeDiff([2, 'a']), Error, 'Invalid op')
		assertThrows(() => makeDiff([-2, 'a']), Error, 'Invalid op')
	})
})
