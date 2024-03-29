// @ts-check

import { DiffOperation } from './Diff.mjs'
/** @typedef {import('./Diff.mjs').Diff} Diff */

/**
 * Class representing one patch operation.
 */
export class Patch {
	/** @type {Diff[]} */
	diffs = []
	/** @type {number | null} */
	start1 = null
	/** @type {number | null} */
	start2 = null
	/** @type {number} */
	length1 = 0
	/** @type {number} */
	length2 = 0

	/**
	 * Emulate GNU diff's format.
	 * Header: `@@` -382,8 +481,9 `@@`
	 *
	 * Indices are printed as 1-based, not 0-based.
	 * @returns {string} The GNU diff string.
	 */
	toString() {
		let coords1, coords2
		if (this.length1 === 0) {
			coords1 = this.start1 + ',0'
		} else if (this.length1 === 1) {
			coords1 = (this.start1 ?? 0) + 1
		} else {
			coords1 = ((this.start1 ?? 0) + 1) + ',' + this.length1
		}
		if (this.length2 === 0) {
			coords2 = this.start2 + ',0'
		} else if (this.length2 === 1) {
			coords2 = (this.start2 ?? 0) + 1
		} else {
			coords2 = ((this.start2 ?? 0) + 1) + ',' + this.length2
		}
		const text = ['@@ -' + coords1 + ' +' + coords2 + ' @@\n']
		let op
		// Escape the body of the patch with %xx notation.
		for (let x = 0; x < this.diffs.length; x++) {
			switch (this.diffs[x][0]) {
				case DiffOperation.Insert:
					op = '+'
					break
				case DiffOperation.Delete:
					op = '-'
					break
				case DiffOperation.Equal:
					op = ' '
					break
			}
			text[x + 1] = op + encodeURI(this.diffs[x][1]) + '\n'
		}
		return text.join('').replace(/%20/g, ' ')
	}
}
