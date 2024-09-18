import { Diff, DiffOperation } from './Diff.ts'
import { DiffMatchPatch, MAX_SEGMENTS, MAX_SEGMENTS_2_3 } from './_DiffMatchPatch.ts'
import { SegmentCodec, StringIter } from './_SegmentCodec.ts'

/**
 * Instance-level configuration options for the {@linkcode Differ} class to pass to the underlying
 * {@linkcode DiffMatchPatch} instance.
 */
export type DiffMatchPatchConfig = {
	[K in 'Diff_Timeout' | 'Diff_EditCost' as Uncapitalize<GetK<K>>]: DiffMatchPatch[K]
}
type GetK<Type extends string> = Type extends `Diff_${infer U}` ? U : never

/**
 * Options for methods of the {@linkcode Differ} class.
 */
export type DiffOptions = {
	/**
	 * The segmenter to use for the diff (e.g. chars, words, sentences, lines, graphemes, etc).
	 * Some suitable segmenters are available in the {@linkcode segmenters} object.
	 *
	 * @default {segmenters.char}
	 */
	segmenter: Segmenter
	/**
	 * Whether to count consecutive diff operations containing multiple segments as a single diff.
	 * If `true`, a diff may contain multiple segments; if `false`, each segment will be a separate diff.
	 *
	 * @default {true}
	 */
	join: boolean
	/**
	 * Optional speedup flag:
	 * - If `true`, run a line-level diff first to identify the changed areas.
	 * - If `false`, do a slower, slightly more optimal diff.
	 *
	 * @default {false}
	 */
	checkLines: boolean
}

type Segmenter = SimpleSegmenter | Intl.Segmenter
type SimpleSegmenter = (str: string) => StringIter

/**
 * A collection of commonly-used segmenters, suitable for use as the `segmenter` option in the {@linkcode Differ} class.
 */
export const segmenters: Record<'char' | 'line' | 'grapheme' | 'word' | 'sentence', Segmenter> = {
	char: (str) => str,
	*line(str) {
		for (let i = 0, n = 0; i < str.length; i = n + 1) {
			n = (str.length + str.indexOf('\n', i)) % str.length
			yield str.slice(i, n + 1)
		}
	},
	grapheme: new Intl.Segmenter('en-US', { granularity: 'grapheme' }),
	word: new Intl.Segmenter('en-US', { granularity: 'word' }),
	sentence: new Intl.Segmenter('en-US', { granularity: 'sentence' }),
}

const defaultDiffOptions: DiffOptions = {
	segmenter: segmenters.char,
	join: true,
	checkLines: false,
}

/**
 * A class for performing diffs. Wraps the {@linkcode DiffMatchPatch} class from the original library with more
 * ergonomic and Unicode-friendly methods.
 */
export class Differ {
	#dmp: DiffMatchPatch

	constructor(config?: Partial<DiffMatchPatchConfig>) {
		this.#dmp = new DiffMatchPatch()

		for (const [_k, _v] of Object.entries(config ?? {})) {
			const k = `Diff_${_k.charAt(0).toUpperCase() + _k.slice(1) as Capitalize<
				keyof DiffMatchPatchConfig
			>}` as const
			const v = _v as DiffMatchPatch[typeof k]
			this.#dmp[k] = v
		}
	}

	#diffInternal(before: string, after: string, options: DiffOptions & { maxBefore: number; maxAfter: number }): {
		encodedDiffs: Diff[]
		decode: (encoded: string) => string[]
	} {
		const { segmenter, checkLines, join, maxBefore, maxAfter } = options

		// if no surrogate pairs present, we're entirely within the BMP, so no need to encode
		if (segmenter === segmenters.char && !/[\uD800-\uDBFF]/.test([before, after].join(''))) {
			return {
				encodedDiffs: this.#dmp.diff_main(before, after, checkLines, this.#deadline),
				decode: join ? (x) => [x] : (x) => x.split(''),
			}
		}

		const segment = this.#toSegmentFn(segmenter)

		const codec = new SegmentCodec()

		const chars1 = codec.encode(segment(before), maxBefore)
		const chars2 = codec.encode(segment(after), maxAfter)

		const encodedDiffs = this.#dmp.diff_main(chars1, chars2, checkLines, this.#deadline)

		return { encodedDiffs, decode: codec.decode.bind(codec) }
	}

	/**
	 * Diff two strings. Fully Unicode-aware by default.
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
	diff(before: string, after: string, options?: Partial<DiffOptions>): Diff[] {
		if (before === after) {
			// no need to go any further if both strings are the same
			return before ? [new Diff(DiffOperation.Equal, before)] : []
		}

		const opts = { ...defaultDiffOptions, ...options, maxBefore: MAX_SEGMENTS_2_3, maxAfter: MAX_SEGMENTS }
		const { join } = opts

		const { encodedDiffs, decode } = this.#diffInternal(before, after, opts)

		if (!join) {
			return encodedDiffs.flatMap(
				({ op, text }) => decode(text).filter(Boolean).map((segment) => new Diff(op, segment)),
			)
		}

		return encodedDiffs.map(({ op, text }) => new Diff(op, decode(text).join(''))).filter((x) => x.text)
	}

	/**
	 * Diff two strings by UTF-16 code unit. May not work as expected for non-BMP characters. This is simply a wrapper
	 * around diff-match-patch's `diff_main`, which may be a preferable way to create char diffs compared to
	 * {@linkcode diff} where full Unicode support is not critical and in performance-sensitive scenarios.
	 *
	 * @example
	 * ```ts
	 * import { Differ, segmenters } from '@clearlylocal/diff-match-patch-unicode'
	 *
	 * const differ = new Differ()
	 *
	 * const str1 = 'Hello, world!'
	 * const str2 = 'Goodbye, world!'
	 *
	 * // [-1, "Hell"], [1, "G"], [0, "o"], [1, "odbye"], [0, ", world!"]
	 * differ.diffCodeUnits('Hello, world!', 'Goodbye, world!')
	 *
	 * // [0, "\ud83d"], [-1, "\udcab"], [1, "\udca9"]
	 * differ.diffCodeUnits('💫', '💩')
	 * ```
	 */
	diffCodeUnits(before: string, after: string, options?: Pick<Partial<DiffOptions>, 'checkLines'>): Diff[] {
		const { checkLines } = { ...defaultDiffOptions, ...options }
		return this.#dmp.diff_main(before, after, checkLines, this.#deadline)
	}

	#toSegmentFn(segmenter: Segmenter): SimpleSegmenter {
		if (!(segmenter instanceof Intl.Segmenter)) {
			return segmenter
		}

		return function* (str) {
			for (const s of segmenter.segment(str)) {
				yield s.segment
			}
		}
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
