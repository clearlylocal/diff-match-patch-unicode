import { Diff, DiffOperation } from './Diff.ts'
import { DiffMatchPatch, MAX_BMP_CODEPOINT, TWO_THIRDS_OF_MAX_BMP_CODEPOINT } from './DiffMatchPatch.ts'
import { SegmentCodec, StringIter } from './SegmentCodec.ts'

export type DiffOptions = {
	segmenter: Segmenter
	join: boolean
	checkLines: boolean
}

type Segmenter = SimpleSegmenter | Intl.Segmenter
type SimpleSegmenter = (str: string) => StringIter

export const segmenters: Record<'char' | 'line' | 'grapheme' | 'word' | 'sentence', Segmenter> = {
	char: (str) => str,
	line: (str) => str.split('\n').map((x, i, a) => i === a.length - 1 ? x : x + '\n'),
	grapheme: new Intl.Segmenter('en-US', { granularity: 'grapheme' }),
	word: new Intl.Segmenter('en-US', { granularity: 'word' }),
	sentence: new Intl.Segmenter('en-US', { granularity: 'sentence' }),
}

const defaultDiffOptions: DiffOptions = {
	segmenter: segmenters.char,
	join: true,
	checkLines: false,
}

export class Differ {
	#dmp: DiffMatchPatch

	constructor() {
		this.#dmp = new DiffMatchPatch()
	}

	set diffTimeout(val: number) {
		this.#dmp.Diff_Timeout = val
	}
	get diffTimeout(): number {
		return this.#dmp.Diff_Timeout
	}

	/**
	 * Diff two strings. Unicode-aware by default, including non-BMP characters.
	 *
	 * Pass a `segmenter` option to customize the units of calculation for the diff (char, line, word, grapheme, sentence,
	 * etc).
	 *
	 * @example
	 * ```ts
	 * import { Differ, segmenters } from '@clearlylocal/diff-match-patch-unicode'
	 *
	 * const differ = new Differ()
	 *
	 * const str1 = 'Hello, world! 💫'
	 * const str2 = 'Goodbye, world! 💩'
	 *
	 * // default behavior: UTF-8 char diff
	 * differ.diff(str1, str2) // [-1, "Hell"], [1, "G"], [0, "o"], [1, "odbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]
	 * // word diff with `Intl.Segmenter`
	 * differ.diff(str1, str2, { segmenter: segmenters.word }) // [-1, "Hello"], [1, "Goodbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]
	 * // pass in a custom `Intl.Segmenter` instance
	 * differ.diff('两只小蜜蜂', '两只老虎', { segmenter: new Intl.Segmenter('zh-CN', { granularity: 'word' }) }) // [0, '两只'], [-1, '小蜜蜂'], [1, '老虎']
	 * // line diff
	 * differ.diff(str1, str2, { segmenter: segmenters.line }) // [-1, "Hello, world! 💫"], [1, "Goodbye, world! 💩"]
	 * // custom UTF-16 code-unit diff (equivalent to using `diffCodeUnits` directly... but less performant)
	 * differ.diff(str1, str2, { segmenter: (str) => str.split('') }) // [-1, "Hell"], [1, "G"], [0, "o"], [1, "odbye"], [0, ", world! \ud83d"], [-1, "\udcab"], [1, "\udca9"]
	 * ```
	 */
	diff(str1: string, str2: string, options?: Partial<DiffOptions>): Diff[] {
		if (str1 === str2) {
			// no need to go any further if both strings are the same
			return str1 ? [new Diff(DiffOperation.Equal, str1)] : []
		}

		const opts = { ...defaultDiffOptions, ...options }
		const { segmenter, join, checkLines } = opts

		if (
			// if no surrogate pairs present, we're entirely within the BMP, so no need to encode
			segmenter === segmenters.char && !/[\uD800-\uDBFF]/.test([str1, str2].join('\n'))
		) {
			return this.diffCodeUnits(str1, str2, opts)
		}

		const segment = this.#toSegmentFn(segmenter)

		const codec = new SegmentCodec()

		const chars1 = codec.encode(segment(str1), TWO_THIRDS_OF_MAX_BMP_CODEPOINT)
		const chars2 = codec.encode(segment(str2), MAX_BMP_CODEPOINT)

		const diffs = this.#dmp.diff_main(chars1, chars2, checkLines, this.#deadline)

		if (!join) {
			return diffs.flatMap(
				({ op, text }) => codec.decode(text).filter(Boolean).map((segment) => new Diff(op, segment)),
			)
		}

		return diffs.map(({ op, text }) => new Diff(op, codec.decode(text).join(''))).filter((x) => x.text)
	}

	/**
	 * Diff two strings by UTF-16 code unit. May not work for non-BMP characters. This is simply a wrapper around
	 * diff-match-patch's `diff_main`.
	 *
	 * @example
	 * ```ts
	 * import { Differ, segmenters } from '@clearlylocal/diff-match-patch-unicode'
	 *
	 * const differ = new Differ()
	 *
	 * const str1 = 'Hello, world! 💫'
	 * const str2 = 'Goodbye, world! 💩'
	 * differ.diffCodeUnits(str1, str2) // [-1, "Hell"], [1, "G"], [0, "o"], [1, "odbye"], [0, ", world! \ud83d"], [-1, "\udcab"], [1, "\udca9"]
	 * ```
	 */
	diffCodeUnits(str1: string, str2: string, options?: Pick<Partial<DiffOptions>, 'checkLines'>): Diff[] {
		const { checkLines } = { ...defaultDiffOptions, ...options }
		return this.#dmp.diff_main(str1, str2, checkLines, this.#deadline)
	}

	#toSegmentFn(segmenter: Segmenter): SimpleSegmenter {
		return segmenter instanceof Intl.Segmenter
			? (str) => [...segmenter.segment(str)].map((x) => x.segment)
			: segmenter
	}

	#deadline: number | null = null
	#timeboxed<T>(fn: () => T): T {
		try {
			this.#deadline = new Date().valueOf() + this.#dmp.Diff_Timeout * 1000
			return fn()
		} finally {
			this.#deadline = null
		}
	}

	/**
	 * Convert an less-granular array of diffs to a 2d array of more-granular diffs-within-diffs.
	 *
	 * For example, get word diffs _within_ line diffs.
	 *
	 * @experimental
	 *
	 * @example
	 * ```ts
	 * const text1 = `Line One\nLine Two\nLine Three\n`
	 * const text2 = `Line One\nLine 2\nLine Three\nLine Four\nLine Five\n`
	 *
	 * const diffs = differ.diff(text1, text2, { segmenter: segmenters.line, join: false })
	 * const diff2d = differ.diffWithin(diffs, { segmenter: segmenters.word })
	 *
	 * assertDiffsEqual2d(
	 * 	diff2d,
	 * 	[
	 * 		[[0, 'Line One\n']],
	 * 		[[0, 'Line '], [-1, 'Two'], [1, '2'], [0, '\n']],
	 * 		[[0, 'Line Three\n']],
	 * 		[[1, 'Line Four\n']],
	 * 		[[1, 'Line Five\n']],
	 * 	],
	 * )
	 */
	diffWithin(diffs: Diff[], options?: Partial<DiffOptions>): Diff[][] {
		return this.#timeboxed(() => {
			// avoid mutating input arr
			diffs = diffs.map((d) => d.clone())

			const out: Diff[][] = []

			let ins = ''
			let del = ''

			for (const diff of diffs) {
				switch (diff.op) {
					case DiffOperation.Equal: {
						if (del) out.push([new Diff(DiffOperation.Delete, del)])
						if (ins) out.push([new Diff(DiffOperation.Insert, ins)])

						out.push([diff])
						ins = del = ''
						break
					}
					case DiffOperation.Insert: {
						if (del) {
							out.push(this.diff(del, diff.text, options))
							ins = del = ''
						} else {
							if (ins) out.push([new Diff(DiffOperation.Insert, ins)])
							ins = diff.text
						}
						break
					}
					case DiffOperation.Delete: {
						if (ins) {
							out.push(this.diff(diff.text, ins, options))
							ins = del = ''
						} else {
							if (del) out.push([new Diff(DiffOperation.Delete, del)])
							del = diff.text
						}
						break
					}
				}
			}
			if (del) out.push([new Diff(DiffOperation.Delete, del)])
			if (ins) out.push([new Diff(DiffOperation.Insert, ins)])

			return out
		})
	}
}
