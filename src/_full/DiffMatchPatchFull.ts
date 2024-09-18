import { Diff, DiffOperation } from '../Diff.ts'
import { DiffMatchPatch } from '../_DiffMatchPatch.ts'
import { Patch } from './Patch.ts'

// full version (extending reduced version) - re-add props/methods that are currently unused by `Differ`
// for testing/reference purposes

/**
 * Diff Match and Patch
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Computes the difference between two texts to create a patch.
 * Applies the patch onto another text, allowing for errors.
 * @author fraser@google.com (Neil Fraser)
 */

/**
 * Class containing the diff, match and patch methods.
 */
export class DiffMatchPatchFull extends DiffMatchPatch {
	// Defaults - redefine these in your program to override

	/** At what point is no match declared (0 = perfection, 1 = very loose) */
	Match_Threshold = 0.5
	/**
	 * How far to search for a match (0 = exact location, 1000+ = broad match).
	 * A match this many characters away from the expected location will add 1
	 * to the score (0 is a perfect match).
	 */
	Match_Distance = 1000
	/**
	 * When deleting a large block of text (over ~64 characters), how close do
	 * the contents have to be to match the expected contents. (0 = perfection,
	 * 1 = very loose).  Note that Match_Threshold controls how closely the end
	 * points of a delete need to match.
	 */
	Patch_DeleteThreshold = 0.5
	/** Chunk size for context length */
	Patch_Margin = 4
	/** The number of bits in an int */
	Match_MaxBits = 32

	/**
	 * loc is a location in text1, compute and return the equivalent location in
	 * text2.
	 * e.g. 'The cat' vs 'The big cat', 1->1, 5->8
	 * @param diffs Array of diff tuples.
	 * @param loc Location within text1.
	 * @returns Location within text2.
	 */
	diff_xIndex(diffs: Diff[], loc: number): number {
		let chars1 = 0
		let chars2 = 0
		let last_chars1 = 0
		let last_chars2 = 0
		let x
		for (x = 0; x < diffs.length; x++) {
			if (diffs[x][0] !== DiffOperation.Insert) { // Equality or deletion.
				chars1 += diffs[x][1].length
			}
			if (diffs[x][0] !== DiffOperation.Delete) { // Equality or insertion.
				chars2 += diffs[x][1].length
			}
			if (chars1 > loc) { // Overshot the location.
				break
			}
			last_chars1 = chars1
			last_chars2 = chars2
		}
		// Was the location was deleted?
		if (diffs.length !== x && diffs[x][0] === DiffOperation.Delete) {
			return last_chars2
		}
		// Add the remaining character length.
		return last_chars2 + (loc - last_chars1)
	}

	/**
	 * Convert a diff array into a pretty HTML report.
	 * @param diffs Array of diff tuples.
	 * @returns HTML representation.
	 */
	diff_prettyHtml(diffs: Diff[]): string {
		const html = []
		const pattern_amp = /&/g
		const pattern_lt = /</g
		const pattern_gt = />/g
		const pattern_para = /\n/g
		for (let x = 0; x < diffs.length; x++) {
			const op = diffs[x][0] // Operation (insert, delete, equal)
			const data = diffs[x][1] // Text of change.
			const text = data.replace(pattern_amp, '&amp;').replace(pattern_lt, '&lt;')
				.replace(pattern_gt, '&gt;').replace(pattern_para, '&para;<br>')
			switch (op) {
				case DiffOperation.Insert:
					html[x] = '<ins style="background:#e6ffe6;">' + text + '</ins>'
					break
				case DiffOperation.Delete:
					html[x] = '<del style="background:#ffe6e6;">' + text + '</del>'
					break
				case DiffOperation.Equal:
					html[x] = '<span>' + text + '</span>'
					break
			}
		}
		return html.join('')
	}

	/**
	 * Compute and return the source text (all equalities and deletions).
	 * @param diffs Array of diff tuples.
	 * @returns Source text.
	 */
	diff_text1(diffs: Diff[]): string {
		return diffs.filter(([op]) => op !== DiffOperation.Insert).map(([, text]) => text).join('')
	}

	/**
	 * Compute and return the destination text (all equalities and insertions).
	 * @param diffs Array of diff tuples.
	 * @returns Destination text.
	 */
	diff_text2(diffs: Diff[]): string {
		return diffs.filter(([op]) => op !== DiffOperation.Delete).map(([, text]) => text).join('')
	}

	/**
	 * Compute the Levenshtein distance; the number of inserted, deleted or
	 * substituted characters.
	 * @param diffs Array of diff tuples.
	 * @returns Number of changes.
	 */
	diff_levenshtein(diffs: Diff[]): number {
		let levenshtein = 0
		let insertions = 0
		let deletions = 0
		for (let x = 0; x < diffs.length; x++) {
			const op = diffs[x][0]
			const data = diffs[x][1]
			switch (op) {
				case DiffOperation.Insert:
					insertions += data.length
					break
				case DiffOperation.Delete:
					deletions += data.length
					break
				case DiffOperation.Equal:
					// A deletion and an insertion is one substitution.
					levenshtein += Math.max(insertions, deletions)
					insertions = 0
					deletions = 0
					break
			}
		}
		levenshtein += Math.max(insertions, deletions)
		return levenshtein
	}

	/**
	 * Crush the diff into an encoded string which describes the operations
	 * required to transform text1 into text2.
	 * E.g. =3\t-2\t+ing  -> Keep 3 chars, delete 2 chars, insert 'ing'.
	 * Operations are tab-separated.  Inserted text is escaped using %xx notation.
	 * @param diffs Array of diff tuples.
	 * @returns Delta text.
	 */
	diff_toDelta(diffs: Diff[]): string {
		const text = []
		for (let x = 0; x < diffs.length; x++) {
			switch (diffs[x][0]) {
				case DiffOperation.Insert:
					text[x] = '+' + encodeURI(diffs[x][1])
					break
				case DiffOperation.Delete:
					text[x] = '-' + diffs[x][1].length
					break
				case DiffOperation.Equal:
					text[x] = '=' + diffs[x][1].length
					break
			}
		}
		return text.join('\t').replace(/%20/g, ' ')
	}

	/**
	 * Given the original text1, and an encoded string which describes the
	 * operations required to transform text1 into text2, compute the full diff.
	 * @param text1 Source string for the diff.
	 * @param delta Delta text.
	 * @returns Array of diff tuples.
	 * @throws {Error} If invalid input.
	 */
	diff_fromDelta(text1: string, delta: string): Diff[] {
		const diffs = []
		let diffsLength = 0 // Keeping our own length var is faster in JS.
		let pointer = 0 // Cursor in text1
		const tokens = delta.split(/\t/g)
		for (let x = 0; x < tokens.length; x++) {
			// Each token begins with a one character parameter which specifies the
			// operation of this token (delete, insert, equality).
			const param = tokens[x].substring(1)
			switch (tokens[x].charAt(0)) {
				case '+':
					try {
						diffs[diffsLength++] = new Diff(DiffOperation.Insert, decodeURI(param))
					} catch (_e) {
						// Malformed URI sequence.
						throw new Error('Illegal escape in diff_fromDelta: ' + param)
					}
					break
				case '-':
				// Fall through.
				case '=': {
					const n = parseInt(param, 10)
					if (isNaN(n) || n < 0) {
						throw new Error('Invalid number in diff_fromDelta: ' + param)
					}
					const text = text1.substring(pointer, pointer += n)
					if (tokens[x].charAt(0) === '=') {
						diffs[diffsLength++] = new Diff(DiffOperation.Equal, text)
					} else {
						diffs[diffsLength++] = new Diff(DiffOperation.Delete, text)
					}
					break
				}
				default:
					// Blank tokens are ok (from a trailing \t).
					// Anything else is an error.
					if (tokens[x]) {
						throw new Error(
							'Invalid diff operation in diff_fromDelta: ' +
								tokens[x],
						)
					}
			}
		}
		if (pointer !== text1.length) {
			throw new Error(
				'Delta length (' + pointer +
					') does not equal source text length (' + text1.length + ').',
			)
		}
		return diffs
	}
	//  MATCH FUNCTIONS
	/**
	 * Locate the best instance of 'pattern' in 'text' near 'loc'.
	 * @param text The text to search.
	 * @param pattern The pattern to search for.
	 * @param loc The location to search around.
	 * @returns Best match index or -1.
	 */
	match_main(text: string, pattern: string, loc: number): number {
		loc = Math.max(0, Math.min(loc, text.length))
		if (text === pattern) {
			// Shortcut (potentially not guaranteed by the algorithm)
			return 0
		} else if (!text.length) {
			// Nothing to match.
			return -1
		} else if (text.substring(loc, loc + pattern.length) === pattern) {
			// Perfect match at the perfect spot!  (Includes case of null pattern)
			return loc
		} else {
			// Do a fuzzy compare.
			return this.match_bitap_(text, pattern, loc)
		}
	}

	/**
	 * Locate the best instance of 'pattern' in 'text' near 'loc' using the
	 * Bitap algorithm.
	 * @param text The text to search.
	 * @param pattern The pattern to search for.
	 * @param loc The location to search around.
	 * @returns Best match index or -1.
	 */
	protected match_bitap_(text: string, pattern: string, loc: number): number {
		if (pattern.length > this.Match_MaxBits) {
			throw new Error('Pattern too long for this browser.')
		}

		/**
		 * Compute and return the score for a match with e errors and x location.
		 * Accesses loc and pattern through being a closure.
		 * @param e Number of errors in match.
		 * @param x Location of match.
		 * @returns Overall score for match (0 = good, 1 = bad).
		 *
		 * (Must be arrow function to close around both params and `this`)
		 */
		const match_bitapScore_ = (e: number, x: number): number => {
			const accuracy = e / pattern.length
			const proximity = Math.abs(loc - x)
			if (!this.Match_Distance) {
				// Dodge divide by zero error.
				return proximity ? 1 : accuracy
			}
			return accuracy + (proximity / this.Match_Distance)
		}

		// Initialise the alphabet.
		const s = this.match_alphabet_(pattern)

		// Highest score beyond which we give up.
		let score_threshold = this.Match_Threshold
		// Is there a nearby exact match? (speedup)
		let best_loc = text.indexOf(pattern, loc)
		if (best_loc !== -1) {
			score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold)
			// What about in the other direction? (speedup)
			best_loc = text.lastIndexOf(pattern, loc + pattern.length)
			if (best_loc !== -1) {
				score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold)
			}
		}

		// Initialise the bit arrays.
		const matchmask = 1 << (pattern.length - 1)
		best_loc = -1

		let bin_min, bin_mid
		let bin_max = pattern.length + text.length
		let last_rd: number[]
		for (let d = 0; d < pattern.length; d++) {
			// Scan for the best match; each iteration allows for one more error.
			// Run a binary search to determine how far from 'loc' we can stray at this
			// error level.
			bin_min = 0
			bin_mid = bin_max
			while (bin_min < bin_mid) {
				if (match_bitapScore_(d, loc + bin_mid) <= score_threshold) {
					bin_min = bin_mid
				} else {
					bin_max = bin_mid
				}
				bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min)
			}
			// Use the result from this iteration as the maximum for the next.
			bin_max = bin_mid
			let start = Math.max(1, loc - bin_mid + 1)
			const finish = Math.min(loc + bin_mid, text.length) + pattern.length

			const rd = Array(finish + 2)
			rd[finish + 1] = (1 << d) - 1
			for (let j = finish; j >= start; j--) {
				// The alphabet (s) is a sparse hash, so the following line generates
				// warnings.
				const charMatch = s[text.charAt(j - 1)]
				if (d === 0) { // First pass: exact match.
					rd[j] = ((rd[j + 1] << 1) | 1) & charMatch
				} else { // Subsequent passes: fuzzy match.
					last_rd ??= []

					rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) |
						(((last_rd[j + 1] | last_rd[j]) << 1) | 1) |
						last_rd[j + 1]
				}
				if (rd[j] & matchmask) {
					const score = match_bitapScore_(d, j - 1)
					// This match will almost certainly be better than any existing match.
					// But check anyway.
					if (score <= score_threshold) {
						// Told you so.
						score_threshold = score
						best_loc = j - 1
						if (best_loc > loc) {
							// When passing loc, don't exceed our current distance from loc.
							start = Math.max(1, 2 * loc - best_loc)
						} else {
							// Already passed loc, downhill from here on in.
							break
						}
					}
				}
			}
			// No hope for a (better) match at greater error levels.
			if (match_bitapScore_(d + 1, loc) > score_threshold) {
				break
			}
			last_rd = rd
		}
		return best_loc
	}

	/**
	 * Initialise the alphabet for the Bitap algorithm.
	 * @param pattern The text to encode.
	 * @returns Hash of character locations.
	 */
	protected match_alphabet_(pattern: string): Record<string, number> {
		const s: Record<string, number> = {}
		for (let i = 0; i < pattern.length; i++) {
			s[pattern.charAt(i)] = 0
		}
		for (let i = 0; i < pattern.length; i++) {
			s[pattern.charAt(i)] |= 1 << (pattern.length - i - 1)
		}
		return s
	}
	//  PATCH FUNCTIONS
	/**
	 * Increase the context until it is unique,
	 * but don't let the pattern expand beyond Match_MaxBits.
	 * @param patch The patch to grow.
	 * @param text Source text.
	 */
	protected patch_addContext_(patch: Patch, text: string) {
		if (text.length === 0) {
			return
		}
		if (patch.start2 == null) {
			throw Error('patch not initialized')
		}
		let pattern = text.substring(patch.start2, patch.start2 + patch.length1)
		let padding = 0

		// Look for the first and last matches of pattern in text.  If two different
		// matches are found, increase the pattern length.
		while (
			text.indexOf(pattern) !== text.lastIndexOf(pattern) &&
			pattern.length < this.Match_MaxBits - this.Patch_Margin -
					this.Patch_Margin
		) {
			padding += this.Patch_Margin
			pattern = text.substring(patch.start2 - padding, patch.start2 + patch.length1 + padding)
		}
		// Add one chunk for good luck.
		padding += this.Patch_Margin

		// Add the prefix.
		const prefix = text.substring(patch.start2 - padding, patch.start2)
		if (prefix) {
			patch.diffs.unshift(new Diff(DiffOperation.Equal, prefix))
		}
		// Add the suffix.
		const suffix = text.substring(patch.start2 + patch.length1, patch.start2 + patch.length1 + padding)
		if (suffix) {
			patch.diffs.push(new Diff(DiffOperation.Equal, suffix))
		}

		// Roll back the start points.
		patch.start1 = (patch.start1 ?? 0) - prefix.length
		patch.start2 -= prefix.length
		// Extend the lengths.
		patch.length1 += prefix.length + suffix.length
		patch.length2 += prefix.length + suffix.length
	}

	/**
	 * Compute a list of patches to turn text1 into text2.
	 * Use diffs if provided, otherwise compute it ourselves.
	 * There are four ways to call this function, depending on what data is
	 * available to the caller:
	 * Method 1:
	 * a = text1, b = text2
	 * Method 2:
	 * a = diffs
	 * Method 3 (optimal):
	 * a = text1, b = diffs
	 * Method 4 (deprecated, use method 3):
	 * a = text1, b = text2, c = diffs
	 *
	 * @param a text1 (methods 1,3,4) or
	 * Array of diff tuples for text1 to text2 (method 2).
	 * @param opt_b text2 (methods 1,4) or
	 * Array of diff tuples for text1 to text2 (method 3) or undefined (method 2).
	 * @param opt_c Array of diff tuples
	 * for text1 to text2 (method 4) or undefined (methods 1,2,3).
	 * @returns Array of Patch objects.
	 */
	patch_make(
		a: string | Diff[],
		opt_b?: (string | Diff[]) | undefined,
		opt_c?: (string | Diff[]) | undefined,
	): Patch[] {
		let text1, diffs
		if (typeof a === 'string' && typeof opt_b === 'string' && opt_c == null) {
			// Method 1: text1, text2
			// Compute diffs from text1 and text2.
			text1 = a
			diffs = this.diff_main(text1, opt_b, true)
			if (diffs.length > 2) {
				this.diff_cleanupSemantic(diffs)
				this.diff_cleanupEfficiency(diffs)
			}
		} else if (a && typeof a === 'object' && opt_b == null && opt_c == null) {
			// Method 2: diffs
			// Compute text1 from diffs.
			diffs = a
			text1 = this.diff_text1(diffs)
		} else if (typeof a === 'string' && opt_b && typeof opt_b === 'object' && opt_c == null) {
			// Method 3: text1, diffs
			text1 = a
			diffs = opt_b
		} else if (
			typeof a === 'string' && typeof opt_b === 'string' &&
			opt_c && typeof opt_c === 'object'
		) {
			// Method 4: text1, text2, diffs
			// text2 is not used.
			text1 = a
			diffs = opt_c
		} else {
			throw new Error('Unknown call format to patch_make.')
		}

		if (diffs.length === 0) {
			return [] // Get rid of the null case.
		}
		const patches = []
		let patch = new Patch()
		let patchDiffLength = 0 // Keeping our own length var is faster in JS.
		let char_count1 = 0 // Number of characters into the text1 string.
		let char_count2 = 0 // Number of characters into the text2 string.

		// Start with text1 (prepatch_text) and apply the diffs until we arrive at
		// text2 (postpatch_text).  We recreate the patches one by one to determine
		// context info.
		let prepatch_text = text1
		let postpatch_text = text1
		for (let x = 0; x < diffs.length; x++) {
			const diff_type = diffs[x][0]
			const diff_text = diffs[x][1]

			if (!patchDiffLength && diff_type !== DiffOperation.Equal) {
				// A new patch starts here.
				patch.start1 = char_count1
				patch.start2 = char_count2
			}

			switch (diff_type) {
				case DiffOperation.Insert:
					patch.diffs[patchDiffLength++] = diffs[x]
					patch.length2 += diff_text.length
					postpatch_text = postpatch_text.substring(0, char_count2) + diff_text +
						postpatch_text.substring(char_count2)
					break
				case DiffOperation.Delete:
					patch.length1 += diff_text.length
					patch.diffs[patchDiffLength++] = diffs[x]
					postpatch_text = postpatch_text.substring(0, char_count2) +
						postpatch_text.substring(
							char_count2 +
								diff_text.length,
						)
					break
				case DiffOperation.Equal:
					if (
						diff_text.length <= 2 * this.Patch_Margin &&
						patchDiffLength && diffs.length !== x + 1
					) {
						// Small equality inside a patch.
						patch.diffs[patchDiffLength++] = diffs[x]
						patch.length1 += diff_text.length
						patch.length2 += diff_text.length
					} else if (diff_text.length >= 2 * this.Patch_Margin) {
						// Time for a new patch.
						if (patchDiffLength) {
							this.patch_addContext_(patch, prepatch_text)
							patches.push(patch)
							patch = new Patch()
							patchDiffLength = 0
							// Unlike Unidiff, our patch lists have a rolling context.
							// https://github.com/google/diff-match-patch/wiki/Unidiff
							// Update prepatch text & pos to reflect the application of the
							// just completed patch.
							prepatch_text = postpatch_text
							char_count1 = char_count2
						}
					}
					break
			}

			// Update the current character count.
			if (diff_type !== DiffOperation.Insert) {
				char_count1 += diff_text.length
			}
			if (diff_type !== DiffOperation.Delete) {
				char_count2 += diff_text.length
			}
		}
		// Pick up the leftover patch if not empty.
		if (patchDiffLength) {
			this.patch_addContext_(patch, prepatch_text)
			patches.push(patch)
		}

		return patches
	}

	/**
	 * Given an array of patches, return another array that is identical.
	 * @param patches Array of Patch objects.
	 * @returns Array of Patch objects.
	 */
	patch_deepCopy(patches: Patch[]): Patch[] {
		// Making deep copies is hard in JavaScript.
		const patchesCopy = []
		for (let x = 0; x < patches.length; x++) {
			const patch = patches[x]
			const patchCopy = new Patch()
			patchCopy.diffs = []
			for (let y = 0; y < patch.diffs.length; y++) {
				patchCopy.diffs[y] = new Diff(patch.diffs[y][0], patch.diffs[y][1])
			}
			patchCopy.start1 = patch.start1
			patchCopy.start2 = patch.start2
			patchCopy.length1 = patch.length1
			patchCopy.length2 = patch.length2
			patchesCopy[x] = patchCopy
		}
		return patchesCopy
	}

	/**
	 * Merge a set of patches onto the text.  Return a patched text, as well
	 * as a list of true/false values indicating which patches were applied.
	 * @param patches Array of Patch objects.
	 * @param text Old text.
	 * @returns Two element Array, containing the
	 *      new text and an array of boolean values.
	 */
	patch_apply(patches: Patch[], text: string): [string, boolean[]] {
		if (patches.length === 0) {
			return [text, []]
		}

		// Deep copy the patches so that no changes are made to originals.
		patches = this.patch_deepCopy(patches)

		const nullPadding = this.patch_addPadding(patches)
		text = nullPadding + text + nullPadding

		this.patch_splitMax(patches)
		// delta keeps track of the offset between the expected and actual location
		// of the previous patch.  If there are patches expected at positions 10 and
		// 20, but the first patch was found at 12, delta is 2 and the second patch
		// has an effective expected position of 22.
		let delta = 0
		const results = []
		for (let x = 0; x < patches.length; x++) {
			const expected_loc = (patches[x].start2 ?? 0) + delta
			const text1 = this.diff_text1(patches[x].diffs)
			let start_loc
			let end_loc = -1
			if (text1.length > this.Match_MaxBits) {
				// patch_splitMax will only provide an oversized pattern in the case of
				// a monster delete.
				start_loc = this.match_main(text, text1.substring(0, this.Match_MaxBits), expected_loc)
				if (start_loc !== -1) {
					end_loc = this.match_main(
						text,
						text1.substring(text1.length - this.Match_MaxBits),
						expected_loc + text1.length - this.Match_MaxBits,
					)
					if (end_loc === -1 || start_loc >= end_loc) {
						// Can't find valid trailing context.  Drop this patch.
						start_loc = -1
					}
				}
			} else {
				start_loc = this.match_main(text, text1, expected_loc)
			}
			if (start_loc === -1) {
				// No match found.  :(
				results[x] = false
				// Subtract the delta for this failed patch from subsequent patches.
				delta -= patches[x].length2 - patches[x].length1
			} else {
				// Found a match.  :)
				results[x] = true
				delta = start_loc - expected_loc
				let text2
				if (end_loc === -1) {
					text2 = text.substring(start_loc, start_loc + text1.length)
				} else {
					text2 = text.substring(start_loc, end_loc + this.Match_MaxBits)
				}
				if (text1 === text2) {
					// Perfect match, just shove the replacement text in.
					text = text.substring(0, start_loc) +
						this.diff_text2(patches[x].diffs) +
						text.substring(start_loc + text1.length)
				} else {
					// Imperfect match.  Run a diff to get a framework of equivalent
					// indices.
					const diffs = this.diff_main(text1, text2, false)
					if (
						text1.length > this.Match_MaxBits &&
						this.diff_levenshtein(diffs) / text1.length >
							this.Patch_DeleteThreshold
					) {
						// The end points match, but the content is unacceptably bad.
						results[x] = false
					} else {
						this.diff_cleanupSemanticLossless(diffs)
						let index1 = 0
						let index2
						for (let y = 0; y < patches[x].diffs.length; y++) {
							const mod = patches[x].diffs[y]
							if (mod[0] !== DiffOperation.Equal) {
								index2 = this.diff_xIndex(diffs, index1)
							}
							if (mod[0] === DiffOperation.Insert) { // Insertion
								text = text.substring(0, start_loc + (index2 ?? 0)) + mod[1] +
									text.substring(start_loc + (index2 ?? 0))
							} else if (mod[0] === DiffOperation.Delete) { // Deletion
								text = text.substring(0, start_loc + (index2 ?? 0)) +
									text.substring(start_loc + this.diff_xIndex(diffs, index1 + mod[1].length))
							}
							if (mod[0] !== DiffOperation.Delete) {
								index1 += mod[1].length
							}
						}
					}
				}
			}
		}
		// Strip the padding off.
		text = text.substring(nullPadding.length, text.length - nullPadding.length)
		return [text, results]
	}

	/**
	 * Add some padding on text start and end so that edges can match something.
	 * Intended to be called only from within patch_apply.
	 * @param patches Array of Patch objects.
	 * @returns The padding string added to each side.
	 */
	patch_addPadding(patches: Patch[]): string {
		const paddingLength = this.Patch_Margin
		let nullPadding = ''
		for (let x = 1; x <= paddingLength; x++) {
			nullPadding += String.fromCharCode(x)
		}

		// Bump all the patches forward.
		for (let x = 0; x < patches.length; x++) {
			patches[x].start1 = (patches[x].start1 ?? 0) + paddingLength
			patches[x].start2 = (patches[x].start2 ?? 0) + paddingLength
		}

		// Add some padding on start of first diff.
		let patch = patches[0]
		let diffs = patch.diffs
		if (diffs.length === 0 || diffs[0][0] !== DiffOperation.Equal) {
			// Add nullPadding equality.
			diffs.unshift(new Diff(DiffOperation.Equal, nullPadding))
			patch.start1 = (patch.start1 ?? 0) - paddingLength // Should be 0.
			patch.start2 = (patch.start2 ?? 0) - paddingLength // Should be 0.
			patch.length1 += paddingLength
			patch.length2 += paddingLength
		} else if (paddingLength > diffs[0][1].length) {
			// Grow first equality.
			const extraLength = paddingLength - diffs[0][1].length
			diffs[0][1] = nullPadding.substring(diffs[0][1].length) + diffs[0][1]
			patch.start1 = (patch.start1 ?? 0) - extraLength
			patch.start2 = (patch.start2 ?? 0) - extraLength
			patch.length1 += extraLength
			patch.length2 += extraLength
		}

		// Add some padding on end of last diff.
		patch = patches[patches.length - 1]
		diffs = patch.diffs
		if (diffs.length === 0 || diffs[diffs.length - 1][0] !== DiffOperation.Equal) {
			// Add nullPadding equality.
			diffs.push(new Diff(DiffOperation.Equal, nullPadding))
			patch.length1 += paddingLength
			patch.length2 += paddingLength
		} else if (paddingLength > diffs[diffs.length - 1][1].length) {
			// Grow last equality.
			const extraLength = paddingLength - diffs[diffs.length - 1][1].length
			diffs[diffs.length - 1][1] += nullPadding.substring(0, extraLength)
			patch.length1 += extraLength
			patch.length2 += extraLength
		}

		return nullPadding
	}

	/**
	 * Look through the patches and break up any which are longer than the maximum
	 * limit of the match algorithm.
	 * Intended to be called only from within patch_apply.
	 * @param patches Array of Patch objects.
	 */
	patch_splitMax(patches: Patch[]) {
		const patch_size = this.Match_MaxBits
		for (let x = 0; x < patches.length; x++) {
			if (patches[x].length1 <= patch_size) {
				continue
			}
			const bigpatch = patches[x]
			// Remove the big old patch.
			patches.splice(x--, 1)
			let start1 = bigpatch.start1
			let start2 = bigpatch.start2
			let precontext = ''
			while (bigpatch.diffs.length !== 0) {
				// Create one of several smaller patches.
				const patch = new Patch()
				let empty = true
				patch.start1 = (start1 ?? 0) - precontext.length
				patch.start2 = (start2 ?? 0) - precontext.length
				if (precontext !== '') {
					patch.length1 = patch.length2 = precontext.length
					patch.diffs.push(new Diff(DiffOperation.Equal, precontext))
				}
				while (
					bigpatch.diffs.length !== 0 &&
					patch.length1 < patch_size - this.Patch_Margin
				) {
					const diff_type = bigpatch.diffs[0][0]
					let diff_text = bigpatch.diffs[0][1]
					if (diff_type === DiffOperation.Insert) {
						// Insertions are harmless.
						patch.length2 += diff_text.length
						start2 = (start2 ?? 0) + diff_text.length
						patch.diffs.push(bigpatch.diffs.shift()!)
						empty = false
					} else if (
						diff_type === DiffOperation.Delete && patch.diffs.length === 1 &&
						patch.diffs[0][0] === DiffOperation.Equal &&
						diff_text.length > 2 * patch_size
					) {
						// This is a large deletion.  Let it pass in one chunk.
						patch.length1 += diff_text.length
						start1 = (start1 ?? 0) + diff_text.length
						empty = false
						patch.diffs.push(new Diff(diff_type, diff_text))
						bigpatch.diffs.shift()
					} else {
						// Deletion or equality.  Only take as much as we can stomach.
						diff_text = diff_text.substring(0, patch_size - patch.length1 - this.Patch_Margin)
						patch.length1 += diff_text.length
						start1 = (start1 ?? 0) + diff_text.length
						if (diff_type === DiffOperation.Equal) {
							patch.length2 += diff_text.length
							start2 = (start2 ?? 0) + diff_text.length
						} else {
							empty = false
						}
						patch.diffs.push(new Diff(diff_type, diff_text))
						if (diff_text === bigpatch.diffs[0][1]) {
							bigpatch.diffs.shift()
						} else {
							bigpatch.diffs[0][1] = bigpatch.diffs[0][1].substring(diff_text.length)
						}
					}
				}
				// Compute the head context for the next patch.
				precontext = this.diff_text2(patch.diffs)
				precontext = precontext.substring(precontext.length - this.Patch_Margin)
				// Append the end context for this patch.
				const postcontext = this.diff_text1(bigpatch.diffs)
					.substring(0, this.Patch_Margin)
				if (postcontext !== '') {
					patch.length1 += postcontext.length
					patch.length2 += postcontext.length
					if (
						patch.diffs.length !== 0 &&
						patch.diffs[patch.diffs.length - 1][0] === DiffOperation.Equal
					) {
						patch.diffs[patch.diffs.length - 1][1] += postcontext
					} else {
						patch.diffs.push(new Diff(DiffOperation.Equal, postcontext))
					}
				}
				if (!empty) {
					patches.splice(++x, 0, patch)
				}
			}
		}
	}

	/**
	 * Take a list of patches and return a textual representation.
	 * @param patches Array of Patch objects.
	 * @returns Text representation of patches.
	 */
	patch_toText(patches: Patch[]): string {
		const text = []
		for (let x = 0; x < patches.length; x++) {
			text[x] = patches[x]
		}
		return text.join('')
	}

	/**
	 * Parse a textual representation of patches and return a list of Patch objects.
	 * @param textline Text representation of patches.
	 * @returns Array of Patch objects.
	 * @throws {Error} If invalid input.
	 */
	patch_fromText(textline: string): Patch[] {
		const patches: Patch[] = []
		if (!textline) {
			return patches
		}
		const text = textline.split('\n')
		let textPointer = 0
		const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/
		while (textPointer < text.length) {
			const m = text[textPointer].match(patchHeader)
			if (!m) {
				throw new Error('Invalid patch string: ' + text[textPointer])
			}
			const patch = new Patch()
			patches.push(patch)
			patch.start1 = parseInt(m[1], 10)
			if (m[2] === '') {
				patch.start1--
				patch.length1 = 1
			} else if (m[2] === '0') {
				patch.length1 = 0
			} else {
				patch.start1--
				patch.length1 = parseInt(m[2], 10)
			}

			patch.start2 = parseInt(m[3], 10)
			if (m[4] === '') {
				patch.start2--
				patch.length2 = 1
			} else if (m[4] === '0') {
				patch.length2 = 0
			} else {
				patch.start2--
				patch.length2 = parseInt(m[4], 10)
			}
			textPointer++

			while (textPointer < text.length) {
				const sign = text[textPointer].charAt(0)
				let line
				try {
					line = decodeURI(text[textPointer].substring(1))
				} catch (_ex) {
					// Malformed URI sequence.
					throw new Error('Illegal escape in patch_fromText: ' + line)
				}
				if (sign === '-') {
					// Deletion.
					patch.diffs.push(new Diff(DiffOperation.Delete, line))
				} else if (sign === '+') {
					// Insertion.
					patch.diffs.push(new Diff(DiffOperation.Insert, line))
				} else if (sign === ' ') {
					// Minor equality.
					patch.diffs.push(new Diff(DiffOperation.Equal, line))
				} else if (sign === '@') {
					// Start of next patch.
					break
				} else if (sign === '') {
					// Blank line?  Whatever.
				} else {
					// WTF?
					throw new Error('Invalid patch mode "' + sign + '" in: ' + line)
				}
				textPointer++
			}
		}
		return patches
	}
}
