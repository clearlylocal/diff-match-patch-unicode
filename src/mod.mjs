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
 * 	segmenter: SimpleSegmenter | Intl.Segmenter,
 * }} DiffOptions
 */

/** @typedef {(str: string) => string[]} SimpleSegmenter */

// deno-fmt-ignore
export const segmenters = /** @satisfies {Record<String, SimpleSegmenter>} */ ({
	char: (str) => [...str],
	line: (str) => [...str.matchAll(/^.*(?:\n|$)/gm)].flat(),
	codeUnit: (str) => str.split(''),
})

/** @type DiffOptions */
const defaultDiffOptions = {
	segmenter: segmenters.char,
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
	 * // default behavior: char diff
	 * dmp.diff(str1, str2) // [-1, "Hell"], [1, "Go"], [0, "o"], [1, "dbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]
	 *
	 * // word diff with `Intl.Segmenter`
	 * const segmenter = new Intl.Segmenter('en-US', { granularity: 'word' })
	 * dmp.diff(str1, str2, { segmenter }) // [-1, "Hello"], [1, "Goodbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]
	 *
	 * // line diff
	 * dmp.diff(str1, str2, { segmenter: segmenters.line }) // [-1, "Hello, world! 💫"], [1, "Goodbye, world! 💩"]
	 *
	 * // UTF-16 code-unit diff (equivalent to using `diff_main` directly)
	 * dmp.diff(str1, str2, { segmenter: segmenters.codeUnit }) // [-1, "Hell"], [1, "Go"], [0, "o"], [1, "dbye"], [0, ", world! \ud83d"], [-1, "\udcab"], [1, "\udca9"]
	 * ```
	 */
	diff(str1, str2, options) {
		if (str1 === str2) {
			// no need to encode if both strings are the same
			return str1 ? [new Diff(DiffOperation.Equal, str1)] : []
		}

		const { segmenter } = { ...defaultDiffOptions, ...options }

		const encoder = new SegmentEncoder()

		/** @type {SimpleSegmenter} */
		const segment = segmenter instanceof Intl.Segmenter
			? (str) => [...segmenter.segment(str)].map((x) => x.segment)
			: segmenter

		const chars1 = encoder.encode(segment(str1), TWO_THIRDS_OF_MAX_BMP_CODEPOINT)
		const chars2 = encoder.encode(segment(str2), MAX_BMP_CODEPOINT)

		const d = this.diff_main(chars1, chars2)

		return d.map(({ op, text }) => new Diff(op, [...text].map((x) => encoder.revMap.get(x)).join('')))
	}
}

/**
 * Stateful class for encoding segments as chars
 */
class SegmentEncoder {
	n = 0
	/** @type {Map<string, string>} */
	map = new Map()
	/** @type {Map<string, string>} */
	revMap = new Map()

	/**
	 * @param {string[]} segments
	 * @param {number} max
	 * @returns {string}
	 */
	encode(segments, max) {
		let out = ''
		for (let i = 0; i < segments.length; ++i) {
			const segment = segments[i]

			if (this.map.get(segment) == null) {
				;++this.n

				const char = String.fromCharCode(this.n)

				if (this.n === max) {
					const segment = segments.slice(i).join('')

					this.map.set(segment, char)
					this.revMap.set(char, segment)

					out += char

					break
				}

				this.map.set(segment, char)
				this.revMap.set(char, segment)
			}

			out += this.map.get(segment)
		}

		return out
	}
}
