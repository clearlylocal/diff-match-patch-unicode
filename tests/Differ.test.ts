import { assertEquals } from '@std/assert'
import { Differ, segmenters } from '../src/Differ.ts'
import { DiffMatchPatch } from '../src/DiffMatchPatch.ts'
import { assertDiffsEqual, assertDiffsEqual2d } from './testUtils.ts'

const differ = new Differ()

Deno.test(differ.diff.name, async (t) => {
	await t.step('chars', () => {
		assertDiffsEqual(
			[[-1, 'abc'], [0, 'd'], [1, 'efg']],
			differ.diff('abcd', 'defg'),
		)
	})

	await t.step('non-BMP', async (t) => {
		await t.step('emojis', () => {
			assertDiffsEqual(
				[[-1, '💫'], [1, '💩']],
				differ.diff('💫', '💩'),
			)
		})

		await t.step('can opt into old code unit behavior', () => {
			assertDiffsEqual(
				[[0, '\ud83d'], [-1, '\udcab'], [1, '\udca9']],
				differ.diffCodeUnits('💫', '💩'),
			)

			assertEquals(
				differ.diffCodeUnits('💫', '💩'),
				differ.diff('💫', '💩', { segmenter: (str) => str.split('') }),
			)
		})
	})

	await t.step('words', async (t) => {
		await t.step('default word segmenter', () => {
			assertDiffsEqual(
				[[-1, 'Hello'], [1, 'Goodbye'], [0, ', world!']],
				differ.diff('Hello, world!', 'Goodbye, world!', { segmenter: segmenters.word }),
			)
		})

		await t.step('xml', () => {
			assertDiffsEqual(
				[[0, '<book price="'], [-1, '4.99'], [1, '7.99'], [0, '" />']],
				differ.diff('<book price="4.99" />', '<book price="7.99" />', { segmenter: segmenters.word }),
			)

			assertDiffsEqual(
				[[0, '<book price="'], [-1, '4.99'], [1, '7.99'], [0, '" />']],
				differ.diff('<book price="4.99" />', '<book price="7.99" />', { segmenter: segmenters.word }),
			)
		})

		await t.step('custom word segmenter', () => {
			const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })

			assertDiffsEqual(
				[[0, '两只'], [-1, '小蜜蜂'], [1, '老虎']],
				differ.diff('两只小蜜蜂', '两只老虎', { segmenter }),
			)
		})
	})

	await t.step('custom segmenters', async (t) => {
		await t.step('multiple digits or char via custom regex match', () => {
			const segmenter = (str: string) => str.match(/\d+|./gus) ?? []

			assertDiffsEqual(
				[[-1, 'hell'], [1, 'go'], [0, 'o'], [1, 'dbye'], [0, ' '], [-1, '123'], [1, '135']],
				differ.diff('hello 123', 'goodbye 135', { segmenter }),
			)
		})
	})

	await t.step('parity with line diff function from docs', () => {
		// https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs

		function diffLineMode(text1: string, text2: string) {
			const dmp = new DiffMatchPatch()
			const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(text1, text2)
			const diffs = dmp.diff_main(chars1, chars2, false)
			dmp.diff_charsToLines_(diffs, lineArray)

			return diffs
		}

		const str1 = '11\n12\n13\n14\n15'
		const str2 = '11\n12\n14\n15'

		assertEquals(
			diffLineMode(str1, str2),
			differ.diff(str1, str2, { segmenter: segmenters.line }),
		)
	})
})

Deno.test(differ.diffWithin.name, async (t) => {
	await t.step('chars', () => {
		const text1 = `Line One\nLine Two\nLine Three\n`
		const text2 = `Line One\nLine 2\nLine Three\nLine Four\nLine Five\n`

		const diffs = differ.diff(text1, text2, { segmenter: segmenters.line, join: false })
		const diff2d = differ.diffWithin(diffs, { segmenter: segmenters.word })

		assertDiffsEqual2d(
			diff2d,
			[
				[[0, 'Line One\n']],
				[[0, 'Line '], [-1, 'Two'], [1, '2'], [0, '\n']],
				[[0, 'Line Three\n']],
				[[1, 'Line Four\n']],
				[[1, 'Line Five\n']],
			],
		)
	})
})

Deno.test('README', () => {
	const differ = new Differ()

	const str1 = 'Hello, world! 💫'
	const str2 = 'Goodbye, world! 💩'

	// default behavior: UTF-8 char diff
	assertDiffsEqual(
		differ.diff(str1, str2),
		[[-1, 'Hell'], [1, 'G'], [0, 'o'], [1, 'odbye'], [0, ', world! '], [-1, '💫'], [1, '💩']],
	)

	// word diff with `Intl.Segmenter`
	assertDiffsEqual(
		differ.diff(str1, str2, { segmenter: segmenters.word }),
		[[-1, 'Hello'], [1, 'Goodbye'], [0, ', world! '], [-1, '💫'], [1, '💩']],
	)

	// pass in a custom `Intl.Segmenter` instance
	assertDiffsEqual(
		differ.diff('两只小蜜蜂', '两只老虎', { segmenter: new Intl.Segmenter('zh-CN', { granularity: 'word' }) }),
		[[0, '两只'], [-1, '小蜜蜂'], [1, '老虎']],
	)

	// line diff
	assertDiffsEqual(
		differ.diff(str1, str2, { segmenter: segmenters.line }),
		[[-1, 'Hello, world! 💫'], [1, 'Goodbye, world! 💩']],
	)

	// custom UTF-16 code-unit diff (equivalent to using `diff_main` directly... but less performant)
	assertDiffsEqual(
		differ.diff(str1, str2, { segmenter: (str) => str.split('') }),
		[[-1, 'Hell'], [1, 'G'], [0, 'o'], [1, 'odbye'], [0, ', world! \ud83d'], [-1, '\udcab'], [1, '\udca9']],
	)

	assertDiffsEqual(
		differ.diff(str1, str2, { segmenter: (str) => str.split('') }),
		differ.diffCodeUnits(str1, str2),
	)
})
