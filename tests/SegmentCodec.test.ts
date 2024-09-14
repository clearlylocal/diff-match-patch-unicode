import { AssertionError } from '@std/assert/assertion-error'
import { assertEquals, assertThrows } from '@std/assert'
import { SegmentCodec } from '../src/SegmentCodec.ts'

Deno.test(SegmentCodec.name, async (t) => {
	await t.step('happy path', () => {
		const codec = new SegmentCodec()
		assertEquals(codec.encode('abc', 10), '\x01\x02\x03')
		assertEquals(codec.encode('dea', 10), '\x04\x05\x01')

		assertEquals(codec.decode('\x01\x02\x03'), ['a', 'b', 'c'])
		assertEquals(codec.decode('\x03\x05\x01'), ['c', 'e', 'a'])
	})

	await t.step('exceeds max', () => {
		const codec = new SegmentCodec()
		assertEquals(codec.encode('abc', 2), '\x01\x02')

		assertThrows(
			() => codec.encode('xyz', 2),
			AssertionError,
			'Unreachable: This is a bug in the library.',
		)

		assertEquals(codec.encode('xyz', 3), '\x03')
		assertEquals(codec.decode('\x01\x02\x03'), ['a', 'bc', 'xyz'])
	})
})
