import { assertEquals } from '@std/assert'
import { Differ, segmenters } from './Differ.ts'
import { assertDiffsEqual, assertDiffsEqual2d } from './_testUtils.ts'
import { DiffMatchPatchFull } from './_full/DiffMatchPatchFull.ts'

const differ = new Differ()

Deno.test(differ.diff.name, async (t) => {
	await t.step('chars', () => {
		assertDiffsEqual(
			differ.diff('abcd', 'defg'),
			[[-1, 'abc'], [0, 'd'], [1, 'efg']],
		)
	})

	await t.step('non-BMP', async (t) => {
		await t.step('emojis', () => {
			assertDiffsEqual(
				differ.diff('💫', '💩'),
				[[-1, '💫'], [1, '💩']],
			)
		})

		await t.step('can opt into old code unit behavior', () => {
			assertDiffsEqual(
				differ.diffCodeUnits('💫', '💩'),
				[[0, '\ud83d'], [-1, '\udcab'], [1, '\udca9']],
			)

			assertEquals(
				differ.diffCodeUnits('💫', '💩'),
				differ.diff('💫', '💩', { segmenter: (str) => str.split('') }),
			)
		})
	})

	await t.step('graphemes', () => {
		const before = 'กำ'
		const after = 'ก'

		assertDiffsEqual(
			differ.diff(before, after, { segmenter: segmenters.grapheme }),
			[[-1, 'กำ'], [1, 'ก']],
		)

		// ...compared with default `char` segmenter...
		assertDiffsEqual(
			differ.diff(before, after),
			[[0, 'ก'], [-1, 'ำ']],
		)
	})

	await t.step('sentences', () => {
		assertDiffsEqual(
			differ.diff(
				'This is a sentence. This is another sentence.',
				'This is a sentence. This is yet another sentence.',
				{ segmenter: segmenters.sentence },
			),
			[[0, 'This is a sentence. '], [-1, 'This is another sentence.'], [1, 'This is yet another sentence.']],
		)
	})

	await t.step('words', async (t) => {
		await t.step('default word segmenter', () => {
			assertDiffsEqual(
				differ.diff('Hello, world!', 'Goodbye, world!', { segmenter: segmenters.word }),
				[[-1, 'Hello'], [1, 'Goodbye'], [0, ', world!']],
			)
		})

		await t.step('xml', () => {
			assertDiffsEqual(
				differ.diff('<book price="4.99" />', '<book price="7.99" />', { segmenter: segmenters.word }),
				[[0, '<book price="'], [-1, '4.99'], [1, '7.99'], [0, '" />']],
			)
		})

		await t.step('custom word segmenter', () => {
			const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })

			assertDiffsEqual(
				differ.diff('两只小蜜蜂', '两只老虎', { segmenter }),
				[[0, '两只'], [-1, '小蜜蜂'], [1, '老虎']],
			)
		})
	})

	await t.step('custom segmenters', async (t) => {
		await t.step('multiple digits or char via custom regex match', () => {
			const segmenter = (str: string) => str.match(/\d+|./gus) ?? []

			assertDiffsEqual(
				differ.diff('hello 123', 'goodbye 135', { segmenter }),
				[[-1, 'hell'], [1, 'go'], [0, 'o'], [1, 'dbye'], [0, ' '], [-1, '123'], [1, '135']],
			)
		})
	})

	await t.step('lines (parity with line diff function from docs)', () => {
		function diffLineMode(text1: string, text2: string) {
			// https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs
			const dmp = new DiffMatchPatchFull()
			const { chars1, chars2, lineArray } = dmp['diff_linesToChars_'](text1, text2)
			const diffs = dmp.diff_main(chars1, chars2, false)
			dmp['diff_charsToLines_'](diffs, lineArray)

			return diffs
		}

		const str1 = '11\n12\n13\n14\n15'
		const str2 = '11\n12\n14\n15'

		assertEquals(
			differ.diff(str1, str2, { segmenter: segmenters.line }),
			diffLineMode(str1, str2),
		)
	})
})

Deno.test(differ.diffWithin.name, () => {
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

Deno.test(differ.cleanupSemantic.name, async (t) => {
	await t.step('basic', () => {
		const before = 'Scanne fir ze verbannen, oder verbann dech manuell'
		const after = 'Scanne fir ze verbannen oder Manuell verbannen'

		const expectedUncleanuped = [
			[0, 'Scanne fir ze verbannen'],
			[-1, ','],
			[0, ' oder '],
			[-1, 'verbann'],
			[1, 'Manuell'],
			[0, ' '],
			[-1, 'dech manuell'],
			[1, 'verbannen'],
		]

		const expectedCleanuped = [
			[0, 'Scanne fir ze verbannen'],
			[-1, ','],
			[0, ' oder '],
			[-1, 'verbann dech manuell'],
			[1, 'Manuell verbannen'],
		]

		const uncleanuped = differ.diff(before, after, { segmenter: segmenters.word })
		assertDiffsEqual(uncleanuped, expectedUncleanuped)

		const cleanuped = differ.cleanupSemantic(uncleanuped)
		assertDiffsEqual(cleanuped, expectedCleanuped)
	})
})
