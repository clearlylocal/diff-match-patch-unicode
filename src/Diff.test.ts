import { assert, assertEquals } from '@std/assert'
import { Diff, DiffOperation } from './Diff.ts'

Deno.test(Diff.name, async (t) => {
	await t.step('TypeScript validates inputs', () => {
		;(() => {
			new Diff(0, 'a')
			new Diff(1, 'a')
			new Diff(-1, 'a')

			// @ts-expect-error wrong order
			new Diff('a', 1)
			// @ts-expect-error 2 is not a valid op
			new Diff(2, 'a')
			// @ts-expect-error -2 is not a valid op
			new Diff(-2, 'a')
		})()
	})

	await t.step('diff.op', () => {
		assertEquals(new Diff(DiffOperation.Delete, 'a').op, -1)
		assertEquals(new Diff(DiffOperation.Equal, 'a').op, 0)
		assertEquals(new Diff(DiffOperation.Insert, 'a').op, 1)
	})

	await t.step('other getters', () => {
		const diff = new Diff(DiffOperation.Equal, 'a')
		assertEquals(diff.text, 'a')
		assertEquals(diff.length, 2)
	})

	await t.step('JSON.stringify', () => {
		const diff = new Diff(DiffOperation.Equal, 'a')
		assertEquals(JSON.stringify(diff), '[0,"a"]')
	})

	await t.step('iterate', () => {
		const diff = new Diff(DiffOperation.Equal, 'a')
		assertEquals([...diff], [0, 'a'])
	})

	await t.step('inspect', () => {
		const diff = new Diff(DiffOperation.Equal, 'a')
		assertEquals(Deno.inspect(diff, { colors: false }), 'Diff #[ 0, "a" ]')
		assertEquals(Deno.inspect(diff, { colors: true }), 'Diff #[ \x1b[33m0\x1b[39m, \x1b[32m"a"\x1b[39m ]')
	})

	await t.step('clone', () => {
		const diff = new Diff(DiffOperation.Equal, 'a')
		const clone = diff.clone()
		// value-equal
		assertEquals(diff, clone)
		// not reference-equal
		assert(diff !== clone)
	})
})
