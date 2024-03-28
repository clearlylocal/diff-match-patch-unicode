// @ts-check

import { Diff, diff_match_patch, MAX_BMP_CODEPOINT, TWO_THIRDS_OF_MAX_BMP_CODEPOINT } from './_diff_match_patch.mjs'
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

/**
 * @typedef {{
 * 	n: number,
 * 	map: Map<string, string>,
 * 	revMap: Map<string, string>,
 * }} EncodingState
 */

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
		const { segmenter } = { ...defaultDiffOptions, ...options }

		/** @type {SimpleSegmenter} */
		const segment = segmenter instanceof Intl.Segmenter
			? (str) => [...segmenter.segment(str)].map((x) => x.segment)
			: segmenter

		/** @type {EncodingState} */
		const state = { n: 0, map: new Map(), revMap: new Map() }

		const chars1 = this.#encode(segment(str1), state, TWO_THIRDS_OF_MAX_BMP_CODEPOINT)
		const chars2 = this.#encode(segment(str2), state, MAX_BMP_CODEPOINT)

		const d = this.diff_main(chars1, chars2)

		return d.map(({ op, text }) => new Diff(op, [...text].map((x) => state.revMap.get(x)).join('')))
	}

	/**
	 * @param {string[]} segments
	 * @param {EncodingState} state
	 * @param {number} max
	 * @returns {string}
	 */
	#encode(segments, state, max) {
		let out = ''
		for (let i = 0; i < segments.length; ++i) {
			const segment = segments[i]

			if (state.map.get(segment) == null) {
				;++state.n

				const char = String.fromCharCode(state.n)

				if (state.n === max) {
					const segment = segments.slice(i).join('')

					state.map.set(segment, char)
					state.revMap.set(char, segment)

					out += char

					break
				}

				state.map.set(segment, char)
				state.revMap.set(char, segment)
			}

			out += state.map.get(segment)
		}

		return out
	}
}
