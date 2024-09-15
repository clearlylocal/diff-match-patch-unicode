import { unreachable } from '@std/assert/unreachable'

export type StringIter = Pick<string, typeof Symbol.iterator>

/**
 * Stateful class for encoding and decoding segments <-> chars
 */
export class SegmentCodec {
	#n = 0
	#encoded: Map<string, string> = new Map()
	#decoded: Map<string, string> = new Map()

	encode(segments: StringIter, max: number): string {
		let out = ''

		if (this.#n >= max) {
			// Should be unreachable because we don't expose `SegmentCodec` publicly, and subsequent internal calls to
			// `encode` always use incrementally higher `max` values.
			unreachable(
				'This is a bug in the library. Please report at https://github.com/clearlylocal/diff-match-patch-unicode/issues',
			)
		}

		const statefulSegmentIter = segments[Symbol.iterator]()

		for (const segment of statefulSegmentIter) {
			if (this.#encoded.get(segment) == null) {
				++this.#n

				const char = String.fromCharCode(this.#n)

				if (this.#n === max) {
					const s = [segment, ...statefulSegmentIter].join('')

					this.#encoded.set(s, char)
					this.#decoded.set(char, s)

					out += char

					break
				}

				this.#encoded.set(segment, char)
				this.#decoded.set(char, segment)
			}

			out += this.#encoded.get(segment)!
		}

		return out
	}

	decode(text: string): string[] {
		return [...text].map((char) => this.#decoded.get(char) ?? '')
	}
}
