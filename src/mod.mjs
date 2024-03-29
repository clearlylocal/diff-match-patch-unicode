// @ts-check

import {
	Diff,
	diff_match_patch,
	DiffOperation,
	MAX_BMP_CODEPOINT,
	TWO_THIRDS_OF_MAX_BMP_CODEPOINT,
} from './_diff_match_patch.mjs'
export { Diff, DiffOperation, Patch } from './_diff_match_patch.mjs'

/**
 * @typedef {{
 * 	segmenter: Segmenter,
 * 	join: boolean,
 * }} DiffOptions
 */

/** @typedef {SimpleSegmenter | Intl.Segmenter} Segmenter */
/** @typedef {(str: string) => string[]} SimpleSegmenter */

// deno-fmt-ignore
export const segmenters = /** @satisfies {Record<String, Segmenter>} */ ({
	char: (str) => [...str],
	line: (str) => str.split('\n').map((x, i, a) => i === a.length - 1 ? x : x + '\n'),
	grapheme: new Intl.Segmenter('en-US', { granularity: 'grapheme' }),
	word: new Intl.Segmenter('en-US', { granularity: 'word' }),
	sentence: new Intl.Segmenter('en-US', { granularity: 'sentence' }),
})

/** @type DiffOptions */
const defaultDiffOptions = {
	segmenter: segmenters.char,
	join: true,
}

export class DiffMatchPatch extends diff_match_patch {
	/**
	 * Diff two strings. Unicode-aware by default, including non-BMP characters.
	 *
	 * Pass a `segmenter` option to customize the units of calculation for the diff (char, line, etc).
	 *
	 * @param {string} str1
	 * @param {string} str2
	 * @param {Partial<DiffOptions>} [options]
	 * @returns {Diff[]}
	 *
	 * @example
	 * ```ts
	 * import { DiffMatchPatch, segmenters } from 'diff-match-patch-unicode'
	 *
	 * const dmp = new DiffMatchPatch()
	 *
	 * const str1 = 'Hello, world! 💫'
	 * const str2 = 'Goodbye, world! 💩'
	 *
	 * // default behavior: UTF-8 char diff
	 * dmp.diff(str1, str2) // [-1, "Hell"], [1, "Go"], [0, "o"], [1, "dbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]
	 * // word diff with `Intl.Segmenter`
	 * dmp.diff(str1, str2, { segmenter: segmenters.word }) // [-1, "Hello"], [1, "Goodbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]
	 * // pass in a custom `Intl.Segmenter` instance
	 * dmp.diff('两只小蜜蜂', '两只老虎', { segmenter: new Intl.Segmenter('zh-CN', { granularity: 'word' }) }) // [0, '两只'], [-1, '小蜜蜂'], [1, '老虎']
	 * // line diff
	 * dmp.diff(str1, str2, { segmenter: segmenters.line }) // [-1, "Hello, world! 💫"], [1, "Goodbye, world! 💩"]
	 * // custom UTF-16 code-unit diff (equivalent to using `diff_main` directly... but less performant)
	 * dmp.diff(str1, str2, { segmenter: (str) => str.split('') }) // [-1, "Hell"], [1, "Go"], [0, "o"], [1, "dbye"], [0, ", world! \ud83d"], [-1, "\udcab"], [1, "\udca9"]
	 * ```
	 */
	diff(str1, str2, options) {
		if (str1 === str2) {
			// no need to go any further if both strings are the same
			return str1 ? [new Diff(DiffOperation.Equal, str1)] : []
		}

		const { segmenter, join } = { ...defaultDiffOptions, ...options }

		if (
			// if no surrogate pairs present, we're entirely within the BMP, so no need to encode
			segmenter === segmenters.char && !/[\uD800-\uDBFF]/.test([str1, str2].join('\n'))
		) {
			return this.diff_main(str1, str2, false)
		}

		const segment = this.#toSegmentFn(segmenter)

		const codec = new SegmentCodec()

		const chars1 = codec.encode(segment(str1), TWO_THIRDS_OF_MAX_BMP_CODEPOINT)
		const chars2 = codec.encode(segment(str2), MAX_BMP_CODEPOINT)

		const diffs = this.diff_main(chars1, chars2, false, this.#deadline)

		if (!join) {
			return diffs.flatMap(
				({ op, text }) => codec.decode(text).filter(Boolean).map((segment) => new Diff(op, segment)),
			)
		}

		return diffs.map(({ op, text }) => new Diff(op, codec.decode(text).join(''))).filter((x) => x.text)
	}

	/**
	 * @param {Segmenter} segmenter
	 * @returns {SimpleSegmenter}
	 */
	#toSegmentFn(segmenter) {
		return segmenter instanceof Intl.Segmenter
			? (str) => [...segmenter.segment(str)].map((x) => x.segment)
			: segmenter
	}

	/** @type {number | undefined} */
	#deadline = undefined

	/**
	 * @template T
	 * @param {() => T} fn
	 * @returns {T}
	 */
	#timeboxed(fn) {
		this.#deadline = new Date().valueOf() + this.Diff_Timeout * 1000
		const val = fn()
		this.#deadline = undefined
		return val
	}

	/**
	 * @param {Diff[]} diffs
	 * @param {Partial<DiffOptions>} [options]
	 * @returns {(Diff | Diff[])[]}
	 */
	diffWithin(diffs, options) {
		return this.#timeboxed(() => {
			// avoid mutating input arr
			diffs = diffs.map((d) => d.clone())

			/** @type {(Diff | Diff[])[]} */
			const out = []

			let ins = ''
			let del = ''

			for (const diff of diffs) {
				switch (diff.op) {
					case DiffOperation.Equal: {
						if (del) out.push(new Diff(DiffOperation.Delete, del))
						if (ins) out.push(new Diff(DiffOperation.Insert, ins))

						out.push(diff)
						ins = del = ''
						break
					}
					case DiffOperation.Insert: {
						if (del) {
							out.push(this.diff(del, diff.text, options))
							ins = del = ''
						} else {
							if (ins) out.push(new Diff(DiffOperation.Insert, ins))
							ins = diff.text
						}
						break
					}
					case DiffOperation.Delete: {
						if (ins) {
							out.push(this.diff(diff.text, ins, options))
							ins = del = ''
						} else {
							if (del) out.push(new Diff(DiffOperation.Delete, del))
							del = diff.text
						}
						break
					}
				}
			}
			if (del) out.push(new Diff(DiffOperation.Delete, del))
			if (ins) out.push(new Diff(DiffOperation.Insert, ins))

			return out
		})
	}
}

/**
 * Stateful class for encoding and decoding segments <-> chars
 */
class SegmentCodec {
	#n = 0
	/** @type {Map<string, string>} */
	#encoded = new Map()
	/** @type {Map<string, string>} */
	#decoded = new Map()

	/**
	 * @param {string[]} segments
	 * @param {number} max
	 * @returns {string}
	 */
	encode(segments, max) {
		let out = ''
		for (let i = 0; i < segments.length; ++i) {
			const segment = segments[i]

			if (this.#encoded.get(segment) == null) {
				;++this.#n

				const char = String.fromCharCode(this.#n)

				if (this.#n === max) {
					const segment = segments.slice(i).join('')

					this.#encoded.set(segment, char)
					this.#decoded.set(char, segment)

					out += char

					break
				}

				this.#encoded.set(segment, char)
				this.#decoded.set(char, segment)
			}

			out += this.#encoded.get(segment)
		}

		return out
	}

	/**
	 * @param {string} text
	 * @returns {string[]}
	 */
	decode(text) {
		return [...text].map((char) => this.#decoded.get(char) ?? '')
	}
}
