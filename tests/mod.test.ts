import { assert, assertEquals } from 'std/assert/mod.ts'
import { Diff, Differ, DiffOperation, Patch, segmenters } from '../src/mod.mjs'

/**
 * Diff Match and Patch -- Test Harness
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

const differ = new Differ()

type DiffLike = Diff | [DiffOperation, string]

function makeDiffs(arr: DiffLike[]) {
	// https://github.com/microsoft/TypeScript/issues/42033
	return arr.map(({ 0: op, 1: text }) => new Diff(op, text))
}

function assertDiffsEqual(d1: DiffLike[], d2: DiffLike[]) {
	assertEquals(makeDiffs(d1), makeDiffs(d2))
}

Deno.test('DiffCommonPrefix', function testDiffCommonPrefix() {
	// Detect any common prefix.
	// Null case.
	assertEquals(0, differ.diff_commonPrefix('abc', 'xyz'))

	// Non-null case.
	assertEquals(4, differ.diff_commonPrefix('1234abcdef', '1234xyz'))

	// Whole case.
	assertEquals(4, differ.diff_commonPrefix('1234', '1234xyz'))
})

Deno.test('DiffCommonSuffix', function testDiffCommonSuffix() {
	// Detect any common suffix.
	// Null case.
	assertEquals(0, differ.diff_commonSuffix('abc', 'xyz'))

	// Non-null case.
	assertEquals(4, differ.diff_commonSuffix('abcdef1234', 'xyz1234'))

	// Whole case.
	assertEquals(4, differ.diff_commonSuffix('1234', 'xyz1234'))
})

Deno.test('DiffCommonOverlap', function testDiffCommonOverlap() {
	// testing private method
	const diff_commonOverlap_ = differ['diff_commonOverlap_'].bind(differ)

	// Detect any suffix/prefix overlap.
	// Null case.
	assertEquals(0, diff_commonOverlap_('', 'abcd'))

	// Whole case.
	assertEquals(3, diff_commonOverlap_('abc', 'abcd'))

	// No overlap.
	assertEquals(0, diff_commonOverlap_('123456', 'abcd'))

	// Overlap.
	assertEquals(3, diff_commonOverlap_('123456xxx', 'xxxabcd'))

	// Unicode.
	// Some overly clever languages (C#) may treat ligatures as equal to their
	// component letters.  E.g. U+FB01 == 'fi'
	assertEquals(0, diff_commonOverlap_('fi', '\ufb01i'))
})

Deno.test('DiffHalfMatch', function testDiffHalfMatch() {
	// testing private method
	const diff_halfMatch_ = differ['diff_halfMatch_'].bind(differ)

	// Detect a halfmatch.
	differ.Diff_Timeout = 1
	// No match.
	assertEquals(null, diff_halfMatch_('1234567890', 'abcdef'))

	assertEquals(null, diff_halfMatch_('12345', '23'))

	// Single Match.
	assertEquals(['12', '90', 'a', 'z', '345678'], diff_halfMatch_('1234567890', 'a345678z'))

	assertEquals(['a', 'z', '12', '90', '345678'], diff_halfMatch_('a345678z', '1234567890'))

	assertEquals(['abc', 'z', '1234', '0', '56789'], diff_halfMatch_('abc56789z', '1234567890'))

	assertEquals(['a', 'xyz', '1', '7890', '23456'], diff_halfMatch_('a23456xyz', '1234567890'))

	// Multiple Matches.
	assertEquals(
		['12123', '123121', 'a', 'z', '1234123451234'],
		diff_halfMatch_('121231234123451234123121', 'a1234123451234z'),
	)

	assertEquals(
		['', '-=-=-=-=-=', 'x', '', 'x-=-=-=-=-=-=-='],
		diff_halfMatch_('x-=-=-=-=-=-=-=-=-=-=-=-=', 'xx-=-=-=-=-=-=-='),
	)

	assertEquals(
		['-=-=-=-=-=', '', '', 'y', '-=-=-=-=-=-=-=y'],
		diff_halfMatch_('-=-=-=-=-=-=-=-=-=-=-=-=y', '-=-=-=-=-=-=-=yy'),
	)

	// Non-optimal halfmatch.
	// Optimal diff would be -q+x=H-i+e=lloHe+Hu=llo-Hew+y not -qHillo+x=HelloHe-w+Hulloy
	assertEquals(['qHillo', 'w', 'x', 'Hulloy', 'HelloHe'], diff_halfMatch_('qHilloHelloHew', 'xHelloHeHulloy'))

	// Optimal no halfmatch.
	differ.Diff_Timeout = 0
	assertEquals(null, diff_halfMatch_('qHilloHelloHew', 'xHelloHeHulloy'))
})

Deno.test('DiffLinesToChars', function testDiffLinesToChars() {
	// testing private method
	const diff_linesToChars_ = differ['diff_linesToChars_'].bind(differ)

	function assertLinesToCharsResultEquals(
		a: ReturnType<typeof diff_linesToChars_>,
		b: ReturnType<typeof diff_linesToChars_>,
	) {
		assertEquals(a.chars1, b.chars1)
		assertEquals(a.chars2, b.chars2)
		assertEquals(a.lineArray, b.lineArray)
	}

	// Convert lines down to characters.
	assertLinesToCharsResultEquals({
		chars1: '\x01\x02\x01',
		chars2: '\x02\x01\x02',
		lineArray: ['', 'alpha\n', 'beta\n'],
	}, diff_linesToChars_('alpha\nbeta\nalpha\n', 'beta\nalpha\nbeta\n'))

	assertLinesToCharsResultEquals({
		chars1: '',
		chars2: '\x01\x02\x03\x03',
		lineArray: ['', 'alpha\r\n', 'beta\r\n', '\r\n'],
	}, diff_linesToChars_('', 'alpha\r\nbeta\r\n\r\n\r\n'))

	assertLinesToCharsResultEquals(
		{ chars1: '\x01', chars2: '\x02', lineArray: ['', 'a', 'b'] },
		diff_linesToChars_('a', 'b'),
	)

	// More than 256 to reveal any 8-bit limitations.
	const n = 300
	const lineList = []
	const charList = []
	for (let i = 1; i < n + 1; i++) {
		lineList[i - 1] = i + '\n'
		charList[i - 1] = String.fromCharCode(i)
	}
	assertEquals(n, lineList.length)
	const lines = lineList.join('')
	const chars = charList.join('')
	assertEquals(n, chars.length)
	lineList.unshift('')
	assertLinesToCharsResultEquals(
		{ chars1: chars, chars2: '', lineArray: lineList },
		diff_linesToChars_(lines, ''),
	)
})

Deno.test('DiffCharsToLines', function testDiffCharsToLines() {
	// testing private methods
	const diff_charsToLines_ = differ['diff_charsToLines_'].bind(differ)
	const diff_linesToChars_ = differ['diff_linesToChars_'].bind(differ)

	// Convert chars up to lines.
	let diffs = makeDiffs([[DiffOperation.Equal, '\x01\x02\x01'], [DiffOperation.Insert, '\x02\x01\x02']])

	diff_charsToLines_(diffs, ['', 'alpha\n', 'beta\n'])
	assertDiffsEqual(
		[[DiffOperation.Equal, 'alpha\nbeta\nalpha\n'], [DiffOperation.Insert, 'beta\nalpha\nbeta\n']],
		diffs,
	)

	// More than 256 to reveal any 8-bit limitations.
	const n = 300
	let lineList = []
	const charList = []
	for (let i = 1; i < n + 1; i++) {
		lineList[i - 1] = i + '\n'
		charList[i - 1] = String.fromCharCode(i)
	}
	assertEquals(n, lineList.length)
	const lines = lineList.join('')
	let chars = charList.join('')
	assertEquals(n, chars.length)
	lineList.unshift('')
	diffs = [new Diff(DiffOperation.Delete, chars)]
	diff_charsToLines_(diffs, lineList)
	assertEquals([new Diff(DiffOperation.Delete, lines)], diffs)

	// More than 65536 to verify any 16-bit limitation.
	lineList = []
	for (let i = 0; i < 66000; i++) {
		lineList[i] = i + '\n'
	}
	chars = lineList.join('')
	const results = diff_linesToChars_(chars, '')
	diffs = [new Diff(DiffOperation.Insert, results.chars1)]
	diff_charsToLines_(diffs, results.lineArray)
	assertEquals(chars, diffs[0][1])
})

Deno.test('DiffCleanupMerge', function testDiffCleanupMerge() {
	// Cleanup a messy diff.
	// Null case.
	let diffs: Diff[] = []
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([], diffs)

	// No change case.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Insert, 'c']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Insert, 'c']],
		diffs,
	)

	// Merge equalities.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Equal, 'b'], [DiffOperation.Equal, 'c']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'abc']], diffs)

	// Merge deletions.
	diffs = makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Delete, 'c']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abc']], diffs)

	// Merge insertions.
	diffs = makeDiffs([[DiffOperation.Insert, 'a'], [DiffOperation.Insert, 'b'], [DiffOperation.Insert, 'c']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'abc']], diffs)

	// Merge interweave.
	diffs = makeDiffs([
		[DiffOperation.Delete, 'a'],
		[DiffOperation.Insert, 'b'],
		[DiffOperation.Delete, 'c'],
		[DiffOperation.Insert, 'd'],
		[DiffOperation.Equal, 'e'],
		[
			DiffOperation.Equal,
			'f',
		],
	])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'ac'], [DiffOperation.Insert, 'bd'], [DiffOperation.Equal, 'ef']],
		diffs,
	)

	// Prefix and suffix detection.
	diffs = makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Insert, 'abc'], [DiffOperation.Delete, 'dc']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'd'], [DiffOperation.Insert, 'b'], [
			DiffOperation.Equal,
			'c',
		]],
		diffs,
	)

	// Prefix and suffix detection with equalities.
	diffs = makeDiffs([[DiffOperation.Equal, 'x'], [DiffOperation.Delete, 'a'], [DiffOperation.Insert, 'abc'], [
		DiffOperation.Delete,
		'dc',
	], [DiffOperation.Equal, 'y']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'xa'], [DiffOperation.Delete, 'd'], [DiffOperation.Insert, 'b'], [
			DiffOperation.Equal,
			'cy',
		]],
		diffs,
	)

	// Slide edit left.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Insert, 'ba'], [DiffOperation.Equal, 'c']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'ab'], [DiffOperation.Equal, 'ac']], diffs)

	// Slide edit right.
	diffs = makeDiffs([[DiffOperation.Equal, 'c'], [DiffOperation.Insert, 'ab'], [DiffOperation.Equal, 'a']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'ca'], [DiffOperation.Insert, 'ba']], diffs)

	// Slide edit left recursive.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Equal, 'c'], [
		DiffOperation.Delete,
		'ac',
	], [DiffOperation.Equal, 'x']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abc'], [DiffOperation.Equal, 'acx']], diffs)

	// Slide edit right recursive.
	diffs = makeDiffs([[DiffOperation.Equal, 'x'], [DiffOperation.Delete, 'ca'], [DiffOperation.Equal, 'c'], [
		DiffOperation.Delete,
		'b',
	], [DiffOperation.Equal, 'a']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'xca'], [DiffOperation.Delete, 'cba']], diffs)

	// Empty merge.
	diffs = makeDiffs([[DiffOperation.Delete, 'b'], [DiffOperation.Insert, 'ab'], [DiffOperation.Equal, 'c']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'a'], [DiffOperation.Equal, 'bc']], diffs)

	// Empty equality.
	diffs = makeDiffs([[DiffOperation.Equal, ''], [DiffOperation.Insert, 'a'], [DiffOperation.Equal, 'b']])
	differ.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'a'], [DiffOperation.Equal, 'b']], diffs)
})

Deno.test('DiffCleanupSemanticLossless', function testDiffCleanupSemanticLossless() {
	// Slide diffs to match logical boundaries.
	// Null case.
	let diffs: Diff[] = []
	differ.diff_cleanupSemanticLossless(diffs)
	assertEquals([], diffs)

	// Blank lines.
	diffs = makeDiffs([[DiffOperation.Equal, 'AAA\r\n\r\nBBB'], [DiffOperation.Insert, '\r\nDDD\r\n\r\nBBB'], [
		DiffOperation.Equal,
		'\r\nEEE',
	]])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'AAA\r\n\r\n'], [DiffOperation.Insert, 'BBB\r\nDDD\r\n\r\n'], [
			DiffOperation.Equal,
			'BBB\r\nEEE',
		]],
		diffs,
	)

	// Line boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'AAA\r\nBBB'], [DiffOperation.Insert, ' DDD\r\nBBB'], [
		DiffOperation.Equal,
		' EEE',
	]])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'AAA\r\n'], [DiffOperation.Insert, 'BBB DDD\r\n'], [
			DiffOperation.Equal,
			'BBB EEE',
		]],
		diffs,
	)

	// Word boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'The c'], [DiffOperation.Insert, 'ow and the c'], [
		DiffOperation.Equal,
		'at.',
	]])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The '], [DiffOperation.Insert, 'cow and the '], [
			DiffOperation.Equal,
			'cat.',
		]],
		diffs,
	)

	// Alphanumeric boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'The-c'], [DiffOperation.Insert, 'ow-and-the-c'], [
		DiffOperation.Equal,
		'at.',
	]])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The-'], [DiffOperation.Insert, 'cow-and-the-'], [
			DiffOperation.Equal,
			'cat.',
		]],
		diffs,
	)

	// Hitting the start.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'ax']])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'aax']], diffs)

	// Hitting the end.
	diffs = makeDiffs([[DiffOperation.Equal, 'xa'], [DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'a']])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'xaa'], [DiffOperation.Delete, 'a']], diffs)

	// Sentence boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'The xxx. The '], [DiffOperation.Insert, 'zzz. The '], [
		DiffOperation.Equal,
		'yyy.',
	]])
	differ.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The xxx.'], [DiffOperation.Insert, ' The zzz.'], [
			DiffOperation.Equal,
			' The yyy.',
		]],
		diffs,
	)
})

Deno.test('DiffCleanupSemantic', function testDiffCleanupSemantic() {
	// Cleanup semantically trivial equalities.
	// Null case.
	let diffs: Diff[] = []
	differ.diff_cleanupSemantic(diffs)
	assertEquals([], diffs)

	// No elimination #1.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, 'cd'], [DiffOperation.Equal, '12'], [
		DiffOperation.Delete,
		'e',
	]])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, 'cd'], [DiffOperation.Equal, '12'], [
			DiffOperation.Delete,
			'e',
		]],
		diffs,
	)

	// No elimination #2.
	diffs = makeDiffs([[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, 'ABC'], [DiffOperation.Equal, '1234'], [
		DiffOperation.Delete,
		'wxyz',
	]])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, 'ABC'], [DiffOperation.Equal, '1234'], [
			DiffOperation.Delete,
			'wxyz',
		]],
		diffs,
	)

	// Simple elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'b'], [DiffOperation.Delete, 'c']])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, 'b']], diffs)

	// Backpass elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Equal, 'cd'], [DiffOperation.Delete, 'e'], [
		DiffOperation.Equal,
		'f',
	], [DiffOperation.Insert, 'g']])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abcdef'], [DiffOperation.Insert, 'cdfg']], diffs)

	// Multiple eliminations.
	diffs = makeDiffs([
		[DiffOperation.Insert, '1'],
		[DiffOperation.Equal, 'A'],
		[DiffOperation.Delete, 'B'],
		[DiffOperation.Insert, '2'],
		[DiffOperation.Equal, '_'],
		[DiffOperation.Insert, '1'],
		[DiffOperation.Equal, 'A'],
		[DiffOperation.Delete, 'B'],
		[DiffOperation.Insert, '2'],
	])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'AB_AB'], [DiffOperation.Insert, '1A2_1A2']], diffs)

	// Word boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'The c'], [DiffOperation.Delete, 'ow and the c'], [
		DiffOperation.Equal,
		'at.',
	]])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The '], [DiffOperation.Delete, 'cow and the '], [
			DiffOperation.Equal,
			'cat.',
		]],
		diffs,
	)

	// No overlap elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'abcxx'], [DiffOperation.Insert, 'xxdef']])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abcxx'], [DiffOperation.Insert, 'xxdef']], diffs)

	// Overlap elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'abcxxx'], [DiffOperation.Insert, 'xxxdef']])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'abc'], [DiffOperation.Equal, 'xxx'], [DiffOperation.Insert, 'def']],
		diffs,
	)

	// Reverse overlap elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'xxxabc'], [DiffOperation.Insert, 'defxxx']])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Insert, 'def'], [DiffOperation.Equal, 'xxx'], [DiffOperation.Delete, 'abc']],
		diffs,
	)

	// Two overlap eliminations.
	diffs = makeDiffs([[DiffOperation.Delete, 'abcd1212'], [DiffOperation.Insert, '1212efghi'], [
		DiffOperation.Equal,
		'----',
	], [
		DiffOperation.Delete,
		'A3',
	], [
		DiffOperation.Insert,
		'3BC',
	]])
	differ.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[
			[DiffOperation.Delete, 'abcd'],
			[DiffOperation.Equal, '1212'],
			[DiffOperation.Insert, 'efghi'],
			[DiffOperation.Equal, '----'],
			[DiffOperation.Delete, 'A'],
			[DiffOperation.Equal, '3'],
			[DiffOperation.Insert, 'BC'],
		],
		diffs,
	)
})

Deno.test('DiffCleanupEfficiency', function testDiffCleanupEfficiency() {
	// Cleanup operationally trivial equalities.
	differ.Diff_EditCost = 4
	// Null case.
	let diffs: Diff[] = []
	differ.diff_cleanupEfficiency(diffs)
	assertEquals([], diffs)

	// No elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, '12'], [DiffOperation.Equal, 'wxyz'], [
		DiffOperation.Delete,
		'cd',
	], [DiffOperation.Insert, '34']])
	differ.diff_cleanupEfficiency(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, '12'], [DiffOperation.Equal, 'wxyz'], [
			DiffOperation.Delete,
			'cd',
		], [
			DiffOperation.Insert,
			'34',
		]],
		diffs,
	)

	// Four-edit elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, '12'], [DiffOperation.Equal, 'xyz'], [
		DiffOperation.Delete,
		'cd',
	], [DiffOperation.Insert, '34']])
	differ.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abxyzcd'], [DiffOperation.Insert, '12xyz34']], diffs)

	// Three-edit elimination.
	diffs = makeDiffs([[DiffOperation.Insert, '12'], [DiffOperation.Equal, 'x'], [DiffOperation.Delete, 'cd'], [
		DiffOperation.Insert,
		'34',
	]])
	differ.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'xcd'], [DiffOperation.Insert, '12x34']], diffs)

	// Backpass elimination.
	diffs = makeDiffs([
		[DiffOperation.Delete, 'ab'],
		[DiffOperation.Insert, '12'],
		[DiffOperation.Equal, 'xy'],
		[DiffOperation.Insert, '34'],
		[DiffOperation.Equal, 'z'],
		[
			DiffOperation.Delete,
			'cd',
		],
		[DiffOperation.Insert, '56'],
	])
	differ.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abxyzcd'], [DiffOperation.Insert, '12xy34z56']], diffs)

	// High cost elimination.
	differ.Diff_EditCost = 5
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, '12'], [DiffOperation.Equal, 'wxyz'], [
		DiffOperation.Delete,
		'cd',
	], [DiffOperation.Insert, '34']])
	differ.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abwxyzcd'], [DiffOperation.Insert, '12wxyz34']], diffs)
	differ.Diff_EditCost = 4
})

Deno.test('DiffPrettyHtml', function testDiffPrettyHtml() {
	// Pretty print.
	const diffs = makeDiffs([[DiffOperation.Equal, 'a\n'], [DiffOperation.Delete, '<B>b</B>'], [
		DiffOperation.Insert,
		'c&d',
	]])
	assertEquals(
		'<span>a&para;<br></span><del style="background:#ffe6e6;">&lt;B&gt;b&lt;/B&gt;</del><ins style="background:#e6ffe6;">c&amp;d</ins>',
		differ.diff_prettyHtml(diffs),
	)
})

Deno.test('DiffText', function testDiffText() {
	// Compute the source and destination texts.
	const diffs = makeDiffs([
		[DiffOperation.Equal, 'jump'],
		[DiffOperation.Delete, 's'],
		[DiffOperation.Insert, 'ed'],
		[DiffOperation.Equal, ' over '],
		[DiffOperation.Delete, 'the'],
		[DiffOperation.Insert, 'a'],
		[DiffOperation.Equal, ' lazy'],
	])
	assertEquals('jumps over the lazy', differ.diff_text1(diffs))

	assertEquals('jumped over a lazy', differ.diff_text2(diffs))
})

Deno.test('DiffDelta', function testDiffDelta() {
	// Convert a diff into delta string.
	let diffs = makeDiffs([
		[DiffOperation.Equal, 'jump'],
		[DiffOperation.Delete, 's'],
		[DiffOperation.Insert, 'ed'],
		[DiffOperation.Equal, ' over '],
		[DiffOperation.Delete, 'the'],
		[DiffOperation.Insert, 'a'],
		[DiffOperation.Equal, ' lazy'],
		[DiffOperation.Insert, 'old dog'],
	])
	let text1 = differ.diff_text1(diffs)
	assertEquals('jumps over the lazy', text1)

	let delta = differ.diff_toDelta(diffs)
	assertEquals('=4\t-1\t+ed\t=6\t-3\t+a\t=5\t+old dog', delta)

	// Convert delta string into a diff.
	assertEquals(diffs, differ.diff_fromDelta(text1, delta))

	// Generates error (19 != 20).
	try {
		differ.diff_fromDelta(text1 + 'x', delta)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}

	// Generates error (19 != 18).
	try {
		differ.diff_fromDelta(text1.substring(1), delta)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}

	// Generates error (%c3%xy invalid Unicode).
	try {
		differ.diff_fromDelta('', '+%c3%xy')
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}

	// Test deltas with special characters.
	diffs = makeDiffs([[DiffOperation.Equal, '\u0680 \x00 \t %'], [DiffOperation.Delete, '\u0681 \x01 \n ^'], [
		DiffOperation.Insert,
		'\u0682 \x02 \\ |',
	]])
	text1 = differ.diff_text1(diffs)
	assertEquals('\u0680 \x00 \t %\u0681 \x01 \n ^', text1)

	delta = differ.diff_toDelta(diffs)
	assertEquals('=7\t-7\t+%DA%82 %02 %5C %7C', delta)

	// Convert delta string into a diff.
	assertEquals(diffs, differ.diff_fromDelta(text1, delta))

	// Verify pool of unchanged characters.
	diffs = makeDiffs([[DiffOperation.Insert, "A-Z a-z 0-9 - _ . ! ~ * ' ( ) ; / ? : @ & = + $ , # "]])
	const text2 = differ.diff_text2(diffs)
	assertEquals("A-Z a-z 0-9 - _ . ! ~ * ' ( ) ; / ? : @ & = + $ , # ", text2)

	delta = differ.diff_toDelta(diffs)
	assertEquals("+A-Z a-z 0-9 - _ . ! ~ * ' ( ) ; / ? : @ & = + $ , # ", delta)

	// Convert delta string into a diff.
	assertEquals(diffs, differ.diff_fromDelta('', delta))

	// 160 kb string.
	let a = 'abcdefghij'
	for (let i = 0; i < 14; i++) {
		a += a
	}
	diffs = makeDiffs([[DiffOperation.Insert, a]])
	delta = differ.diff_toDelta(diffs)
	assertEquals('+' + a, delta)

	// Convert delta string into a diff.
	assertEquals(diffs, differ.diff_fromDelta('', delta))
})

Deno.test('DiffXIndex', function testDiffXIndex() {
	// Translate a location in text1 to text2.
	// Translation on equality.
	assertEquals(
		5,
		differ.diff_xIndex(
			makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Insert, '1234'], [DiffOperation.Equal, 'xyz']]),
			2,
		),
	)

	// Translation on deletion.
	assertEquals(
		1,
		differ.diff_xIndex(
			makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, '1234'], [DiffOperation.Equal, 'xyz']]),
			3,
		),
	)
})

Deno.test('DiffLevenshtein', function testDiffLevenshtein() {
	// Levenshtein with trailing equality.
	assertEquals(
		4,
		differ.diff_levenshtein(makeDiffs([[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, '1234'], [
			DiffOperation.Equal,
			'xyz',
		]])),
	)
	// Levenshtein with leading equality.
	assertEquals(
		4,
		differ.diff_levenshtein(makeDiffs([[DiffOperation.Equal, 'xyz'], [DiffOperation.Delete, 'abc'], [
			DiffOperation.Insert,
			'1234',
		]])),
	)
	// Levenshtein with middle equality.
	assertEquals(
		7,
		differ.diff_levenshtein(makeDiffs([[DiffOperation.Delete, 'abc'], [DiffOperation.Equal, 'xyz'], [
			DiffOperation.Insert,
			'1234',
		]])),
	)
})

Deno.test('DiffBisect', function testDiffBisect() {
	// Normal.
	const a = 'cat'
	const b = 'map'
	// Since the resulting diff hasn't been normalized, it would be ok if
	// the insertion and deletion pairs are swapped.
	// If the order changes, tweak this test as required.
	assertDiffsEqual(
		[[DiffOperation.Delete, 'c'], [DiffOperation.Insert, 'm'], [DiffOperation.Equal, 'a'], [
			DiffOperation.Delete,
			't',
		], [
			DiffOperation.Insert,
			'p',
		]],
		differ['diff_bisect_'](a, b, Number.MAX_VALUE),
	)

	// Timeout.
	assertDiffsEqual(
		[[DiffOperation.Delete, 'cat'], [DiffOperation.Insert, 'map']],
		differ['diff_bisect_'](a, b, 0),
	)
})

Deno.test('DiffMain', function testDiffMain() {
	function diff_rebuildtexts(diffs: Diff[]) {
		// Construct the two texts which made up the diff originally.
		let text1 = ''
		let text2 = ''
		for (let x = 0; x < diffs.length; x++) {
			if (diffs[x][0] != DiffOperation.Insert) {
				text1 += diffs[x][1]
			}
			if (diffs[x][0] != DiffOperation.Delete) {
				text2 += diffs[x][1]
			}
		}
		return [text1, text2]
	}

	// Perform a trivial diff.
	// Null case.
	assertEquals([], differ.diff_main('', '', false))

	// Equality.
	assertDiffsEqual([[DiffOperation.Equal, 'abc']], differ.diff_main('abc', 'abc', false))

	// Simple insertion.
	assertDiffsEqual(
		[[DiffOperation.Equal, 'ab'], [DiffOperation.Insert, '123'], [DiffOperation.Equal, 'c']],
		differ.diff_main('abc', 'ab123c', false),
	)

	// Simple deletion.
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Delete, '123'], [DiffOperation.Equal, 'bc']],
		differ.diff_main('a123bc', 'abc', false),
	)

	// Two insertions.
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Insert, '123'], [DiffOperation.Equal, 'b'], [
			DiffOperation.Insert,
			'456',
		], [
			DiffOperation.Equal,
			'c',
		]],
		differ.diff_main('abc', 'a123b456c', false),
	)

	// Two deletions.
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Delete, '123'], [DiffOperation.Equal, 'b'], [
			DiffOperation.Delete,
			'456',
		], [
			DiffOperation.Equal,
			'c',
		]],
		differ.diff_main('a123b456c', 'abc', false),
	)

	// Perform a real diff.
	// Switch off the timeout.
	differ.Diff_Timeout = 0
	// Simple cases.
	assertDiffsEqual([[DiffOperation.Delete, 'a'], [DiffOperation.Insert, 'b']], differ.diff_main('a', 'b', false))

	assertDiffsEqual(
		[
			[DiffOperation.Delete, 'Apple'],
			[DiffOperation.Insert, 'Banana'],
			[DiffOperation.Equal, 's are a'],
			[DiffOperation.Insert, 'lso'],
			[
				DiffOperation.Equal,
				' fruit.',
			],
		],
		differ.diff_main('Apples are a fruit.', 'Bananas are also fruit.', false),
	)

	assertDiffsEqual(
		[[DiffOperation.Delete, 'a'], [DiffOperation.Insert, '\u0680'], [DiffOperation.Equal, 'x'], [
			DiffOperation.Delete,
			'\t',
		], [
			DiffOperation.Insert,
			'\0',
		]],
		differ.diff_main('ax\t', '\u0680x\0', false),
	)

	// Overlaps.
	assertDiffsEqual(
		[
			[DiffOperation.Delete, '1'],
			[DiffOperation.Equal, 'a'],
			[DiffOperation.Delete, 'y'],
			[DiffOperation.Equal, 'b'],
			[DiffOperation.Delete, '2'],
			[DiffOperation.Insert, 'xab'],
		],
		differ.diff_main('1ayb2', 'abxab', false),
	)

	assertDiffsEqual(
		[[DiffOperation.Insert, 'xaxcx'], [DiffOperation.Equal, 'abc'], [DiffOperation.Delete, 'y']],
		differ.diff_main('abcy', 'xaxcxabc', false),
	)

	assertDiffsEqual(
		[
			[DiffOperation.Delete, 'ABCD'],
			[DiffOperation.Equal, 'a'],
			[DiffOperation.Delete, '='],
			[DiffOperation.Insert, '-'],
			[DiffOperation.Equal, 'bcd'],
			[DiffOperation.Delete, '='],
			[DiffOperation.Insert, '-'],
			[DiffOperation.Equal, 'efghijklmnopqrs'],
			[DiffOperation.Delete, 'EFGHIJKLMNOefg'],
		],
		differ.diff_main('ABCDa=bcd=efghijklmnopqrsEFGHIJKLMNOefg', 'a-bcd-efghijklmnopqrs', false),
	)

	// Large equality.
	assertDiffsEqual(
		[[DiffOperation.Insert, ' '], [DiffOperation.Equal, 'a'], [DiffOperation.Insert, 'nd'], [
			DiffOperation.Equal,
			' [[Pennsylvania]]',
		], [
			DiffOperation.Delete,
			' and [[New',
		]],
		differ.diff_main('a [[Pennsylvania]] and [[New', ' and [[Pennsylvania]]', false),
	)

	// Timeout.
	differ.Diff_Timeout = 0.1 // 100ms
	let a =
		'`Twas brillig, and the slithy toves\nDid gyre and gimble in the wabe:\nAll mimsy were the borogoves,\nAnd the mome raths outgrabe.\n'
	let b =
		"I am the very model of a modern major general,\nI've information vegetable, animal, and mineral,\nI know the kings of England, and I quote the fights historical,\nFrom Marathon to Waterloo, in order categorical.\n"
	// Increase the text lengths by 1024 times to ensure a timeout.
	for (let i = 0; i < 10; i++) {
		a += a
		b += b
	}
	const startTime = (new Date()).getTime()
	differ.diff_main(a, b)
	const endTime = (new Date()).getTime()
	// Test that we took at least the timeout period.
	assert(differ.Diff_Timeout * 1000 <= endTime - startTime)
	// Test that we didn't take forever (be forgiving).
	// Theoretically this test could fail very occasionally if the
	// OS task swaps or locks up for a second at the wrong moment.
	assert(differ.Diff_Timeout * 1000 * 2 > endTime - startTime)
	differ.Diff_Timeout = 0

	// Test the linemode speedup.
	// Must be long to pass the 100 char cutoff.
	// Simple line-mode.
	a = '1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n'
	b = 'abcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\n'
	assertEquals(differ.diff_main(a, b, false), differ.diff_main(a, b, true))

	// Single line-mode.
	a = '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890'
	b = 'abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij'
	assertEquals(differ.diff_main(a, b, false), differ.diff_main(a, b, true))

	// Overlap line-mode.
	a = '1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n'
	b = 'abcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n'
	const texts_linemode = diff_rebuildtexts(differ.diff_main(a, b, true))
	const texts_textmode = diff_rebuildtexts(differ.diff_main(a, b, false))
	assertEquals(texts_textmode, texts_linemode)

	// Test null inputs.
	try {
		// @ts-expect-error null not allowed
		differ.diff_main(null, null)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

// MATCH TEST FUNCTIONS

Deno.test('MatchAlphabet', function testMatchAlphabet() {
	// Initialise the bitmasks for Bitap.
	// Unique.
	assertEquals({ 'a': 4, 'b': 2, 'c': 1 }, differ['match_alphabet_']('abc'))

	// Duplicates.
	assertEquals({ 'a': 37, 'b': 18, 'c': 8 }, differ['match_alphabet_']('abcaba'))
})

Deno.test('MatchBitap', function testMatchBitap() {
	// testing private method
	const match_bitap_ = differ['match_bitap_'].bind(differ)

	// Bitap algorithm.
	differ.Match_Distance = 100
	differ.Match_Threshold = 0.5
	// Exact matches.
	assertEquals(5, match_bitap_('abcdefghijk', 'fgh', 5))

	assertEquals(5, match_bitap_('abcdefghijk', 'fgh', 0))

	// Fuzzy matches.
	assertEquals(4, match_bitap_('abcdefghijk', 'efxhi', 0))

	assertEquals(2, match_bitap_('abcdefghijk', 'cdefxyhijk', 5))

	assertEquals(-1, match_bitap_('abcdefghijk', 'bxy', 1))

	// Overflow.
	assertEquals(2, match_bitap_('123456789xx0', '3456789x0', 2))

	// Threshold test.
	differ.Match_Threshold = 0.4
	assertEquals(4, match_bitap_('abcdefghijk', 'efxyhi', 1))

	differ.Match_Threshold = 0.3
	assertEquals(-1, match_bitap_('abcdefghijk', 'efxyhi', 1))

	differ.Match_Threshold = 0.0
	assertEquals(1, match_bitap_('abcdefghijk', 'bcdef', 1))
	differ.Match_Threshold = 0.5

	// Multiple select.
	assertEquals(0, match_bitap_('abcdexyzabcde', 'abccde', 3))

	assertEquals(8, match_bitap_('abcdexyzabcde', 'abccde', 5))

	// Distance test.
	differ.Match_Distance = 10 // Strict location.
	assertEquals(-1, match_bitap_('abcdefghijklmnopqrstuvwxyz', 'abcdefg', 24))

	assertEquals(0, match_bitap_('abcdefghijklmnopqrstuvwxyz', 'abcdxxefg', 1))

	differ.Match_Distance = 1000 // Loose location.
	assertEquals(0, match_bitap_('abcdefghijklmnopqrstuvwxyz', 'abcdefg', 24))
})

Deno.test('MatchMain', function testMatchMain() {
	// Full match.
	// Shortcut matches.
	assertEquals(0, differ.match_main('abcdef', 'abcdef', 1000))

	assertEquals(-1, differ.match_main('', 'abcdef', 1))

	assertEquals(3, differ.match_main('abcdef', '', 3))

	assertEquals(3, differ.match_main('abcdef', 'de', 3))

	// Beyond end match.
	assertEquals(3, differ.match_main('abcdef', 'defy', 4))

	// Oversized pattern.
	assertEquals(0, differ.match_main('abcdef', 'abcdefy', 0))

	// Complex match.
	assertEquals(4, differ.match_main('I am the very model of a modern major general.', ' that berry ', 5))

	// Test null inputs.
	try {
		// @ts-expect-error null not allowed
		differ.match_main(null, null, 0)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

// PATCH TEST FUNCTIONS

Deno.test('PatchObj', function testPatchObj() {
	// Patch Object.
	const p = new Patch()
	p.start1 = 20
	p.start2 = 21
	p.length1 = 18
	p.length2 = 17
	p.diffs = makeDiffs([
		[DiffOperation.Equal, 'jump'],
		[DiffOperation.Delete, 's'],
		[DiffOperation.Insert, 'ed'],
		[DiffOperation.Equal, ' over '],
		[DiffOperation.Delete, 'the'],
		[DiffOperation.Insert, 'a'],
		[DiffOperation.Equal, '\nlaz'],
	])
	const strp = p.toString()
	assertEquals('@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n %0Alaz\n', strp)
})

Deno.test('PatchFromText', function testPatchFromText() {
	assertEquals([], differ.patch_fromText(''))
	// @ts-expect-error null
	assertEquals([], differ.patch_fromText(null))
	// @ts-expect-error undefined
	assertEquals([], differ.patch_fromText(undefined))

	const strp = '@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n %0Alaz\n'

	assertEquals(strp, differ.patch_fromText(strp)[0].toString())

	assertEquals('@@ -1 +1 @@\n-a\n+b\n', differ.patch_fromText('@@ -1 +1 @@\n-a\n+b\n')[0].toString())

	assertEquals('@@ -1,3 +0,0 @@\n-abc\n', differ.patch_fromText('@@ -1,3 +0,0 @@\n-abc\n')[0].toString())

	assertEquals('@@ -0,0 +1,3 @@\n+abc\n', differ.patch_fromText('@@ -0,0 +1,3 @@\n+abc\n')[0].toString())

	// Generates error.
	try {
		differ.patch_fromText('Bad\nPatch\n')
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

Deno.test('PatchToText', function testPatchToText() {
	let strp = '@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n  laz\n'
	let p = differ.patch_fromText(strp)
	assertEquals(strp, differ.patch_toText(p))

	strp = '@@ -1,9 +1,9 @@\n-f\n+F\n oo+fooba\n@@ -7,9 +7,9 @@\n obar\n-,\n+.\n  tes\n'
	p = differ.patch_fromText(strp)
	assertEquals(strp, differ.patch_toText(p))
})

Deno.test('PatchAddContext', function testPatchAddContext() {
	// testing private method
	const patch_addContext_ = differ['patch_addContext_'].bind(differ)

	differ.Patch_Margin = 4
	let p = differ.patch_fromText('@@ -21,4 +21,10 @@\n-jump\n+somersault\n')[0]
	patch_addContext_(p, 'The quick brown fox jumps over the lazy dog.')
	assertEquals('@@ -17,12 +17,18 @@\n fox \n-jump\n+somersault\n s ov\n', p.toString())

	// Same, but not enough trailing context.
	p = differ.patch_fromText('@@ -21,4 +21,10 @@\n-jump\n+somersault\n')[0]
	patch_addContext_(p, 'The quick brown fox jumps.')
	assertEquals('@@ -17,10 +17,16 @@\n fox \n-jump\n+somersault\n s.\n', p.toString())

	// Same, but not enough leading context.
	p = differ.patch_fromText('@@ -3 +3,2 @@\n-e\n+at\n')[0]
	patch_addContext_(p, 'The quick brown fox jumps.')
	assertEquals('@@ -1,7 +1,8 @@\n Th\n-e\n+at\n  qui\n', p.toString())

	// Same, but with ambiguity.
	p = differ.patch_fromText('@@ -3 +3,2 @@\n-e\n+at\n')[0]
	patch_addContext_(p, 'The quick brown fox jumps.  The quick brown fox crashes.')
	assertEquals('@@ -1,27 +1,28 @@\n Th\n-e\n+at\n  quick brown fox jumps. \n', p.toString())
})

Deno.test('PatchMake', function testPatchMake() {
	// Null case.
	let patches = differ.patch_make('', '')
	assertEquals('', differ.patch_toText(patches))

	let text1 = 'The quick brown fox jumps over the lazy dog.'
	let text2 = 'That quick brown fox jumped over a lazy dog.'
	// Text2+Text1 inputs.
	let expectedPatch =
		'@@ -1,8 +1,7 @@\n Th\n-at\n+e\n  qui\n@@ -21,17 +21,18 @@\n jump\n-ed\n+s\n  over \n-a\n+the\n  laz\n'
	// The second patch must be "-21,17 +21,18", not "-22,17 +21,18" due to rolling context.
	patches = differ.patch_make(text2, text1)
	assertEquals(expectedPatch, differ.patch_toText(patches))

	// Text1+Text2 inputs.
	expectedPatch =
		'@@ -1,11 +1,12 @@\n Th\n-e\n+at\n  quick b\n@@ -22,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n  laz\n'
	patches = differ.patch_make(text1, text2)
	assertEquals(expectedPatch, differ.patch_toText(patches))

	// Diff input.
	let diffs = differ.diff_main(text1, text2, false)
	patches = differ.patch_make(diffs)
	assertEquals(expectedPatch, differ.patch_toText(patches))

	// Text1+Diff inputs.
	patches = differ.patch_make(text1, diffs)
	assertEquals(expectedPatch, differ.patch_toText(patches))

	// Text1+Text2+Diff inputs (deprecated).
	patches = differ.patch_make(text1, text2, diffs)
	assertEquals(expectedPatch, differ.patch_toText(patches))

	// Character encoding.
	patches = differ.patch_make("`1234567890-=[]\\;',./", '~!@#$%^&*()_+{}|:"<>?')
	assertEquals(
		"@@ -1,21 +1,21 @@\n-%601234567890-=%5B%5D%5C;',./\n+~!@#$%25%5E&*()_+%7B%7D%7C:%22%3C%3E?\n",
		differ.patch_toText(patches),
	)

	// Character decoding.
	diffs = makeDiffs([[DiffOperation.Delete, "`1234567890-=[]\\;',./"], [
		DiffOperation.Insert,
		'~!@#$%^&*()_+{}|:"<>?',
	]])
	assertEquals(
		diffs,
		differ.patch_fromText(
			"@@ -1,21 +1,21 @@\n-%601234567890-=%5B%5D%5C;',./\n+~!@#$%25%5E&*()_+%7B%7D%7C:%22%3C%3E?\n",
		)[0].diffs,
	)

	// Long string with repeats.
	text1 = ''
	for (let x = 0; x < 100; x++) {
		text1 += 'abcdef'
	}
	text2 = text1 + '123'
	expectedPatch = '@@ -573,28 +573,31 @@\n cdefabcdefabcdefabcdefabcdef\n+123\n'
	patches = differ.patch_make(text1, text2)
	assertEquals(expectedPatch, differ.patch_toText(patches))

	// Test null inputs.
	try {
		// @ts-expect-error null
		differ.patch_make(null)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

Deno.test('PatchSplitMax', function testPatchSplitMax() {
	// Assumes that differ.Match_MaxBits is 32.
	let patches = differ.patch_make(
		'abcdefghijklmnopqrstuvwxyz01234567890',
		'XabXcdXefXghXijXklXmnXopXqrXstXuvXwxXyzX01X23X45X67X89X0',
	)
	differ.patch_splitMax(patches)
	assertEquals(
		'@@ -1,32 +1,46 @@\n+X\n ab\n+X\n cd\n+X\n ef\n+X\n gh\n+X\n ij\n+X\n kl\n+X\n mn\n+X\n op\n+X\n qr\n+X\n st\n+X\n uv\n+X\n wx\n+X\n yz\n+X\n 012345\n@@ -25,13 +39,18 @@\n zX01\n+X\n 23\n+X\n 45\n+X\n 67\n+X\n 89\n+X\n 0\n',
		differ.patch_toText(patches),
	)

	patches = differ.patch_make(
		'abcdef1234567890123456789012345678901234567890123456789012345678901234567890uvwxyz',
		'abcdefuvwxyz',
	)
	const oldToText = differ.patch_toText(patches)
	differ.patch_splitMax(patches)
	assertEquals(oldToText, differ.patch_toText(patches))

	patches = differ.patch_make('1234567890123456789012345678901234567890123456789012345678901234567890', 'abc')
	differ.patch_splitMax(patches)
	assertEquals(
		'@@ -1,32 +1,4 @@\n-1234567890123456789012345678\n 9012\n@@ -29,32 +1,4 @@\n-9012345678901234567890123456\n 7890\n@@ -57,14 +1,3 @@\n-78901234567890\n+abc\n',
		differ.patch_toText(patches),
	)

	patches = differ.patch_make(
		'abcdefghij , h : 0 , t : 1 abcdefghij , h : 0 , t : 1 abcdefghij , h : 0 , t : 1',
		'abcdefghij , h : 1 , t : 1 abcdefghij , h : 1 , t : 1 abcdefghij , h : 0 , t : 1',
	)
	differ.patch_splitMax(patches)
	assertEquals(
		'@@ -2,32 +2,32 @@\n bcdefghij , h : \n-0\n+1\n  , t : 1 abcdef\n@@ -29,32 +29,32 @@\n bcdefghij , h : \n-0\n+1\n  , t : 1 abcdef\n',
		differ.patch_toText(patches),
	)
})

Deno.test('PatchAddPadding', function testPatchAddPadding() {
	// Both edges full.
	let patches = differ.patch_make('', 'test')
	assertEquals('@@ -0,0 +1,4 @@\n+test\n', differ.patch_toText(patches))
	differ.patch_addPadding(patches)
	assertEquals('@@ -1,8 +1,12 @@\n %01%02%03%04\n+test\n %01%02%03%04\n', differ.patch_toText(patches))

	// Both edges partial.
	patches = differ.patch_make('XY', 'XtestY')
	assertEquals('@@ -1,2 +1,6 @@\n X\n+test\n Y\n', differ.patch_toText(patches))
	differ.patch_addPadding(patches)
	assertEquals('@@ -2,8 +2,12 @@\n %02%03%04X\n+test\n Y%01%02%03\n', differ.patch_toText(patches))

	// Both edges none.
	patches = differ.patch_make('XXXXYYYY', 'XXXXtestYYYY')
	assertEquals('@@ -1,8 +1,12 @@\n XXXX\n+test\n YYYY\n', differ.patch_toText(patches))
	differ.patch_addPadding(patches)
	assertEquals('@@ -5,8 +5,12 @@\n XXXX\n+test\n YYYY\n', differ.patch_toText(patches))
})

Deno.test('PatchApply', function testPatchApply() {
	differ.Match_Distance = 1000
	differ.Match_Threshold = 0.5
	differ.Patch_DeleteThreshold = 0.5
	// Null case.
	let patches = differ.patch_make('', '')
	let results = differ.patch_apply(patches, 'Hello world.')
	assertEquals(['Hello world.', []], results)

	// Exact match.
	patches = differ.patch_make(
		'The quick brown fox jumps over the lazy dog.',
		'That quick brown fox jumped over a lazy dog.',
	)
	results = differ.patch_apply(patches, 'The quick brown fox jumps over the lazy dog.')
	assertEquals(['That quick brown fox jumped over a lazy dog.', [true, true]], results)

	// Partial match.
	results = differ.patch_apply(patches, 'The quick red rabbit jumps over the tired tiger.')
	assertEquals(['That quick red rabbit jumped over a tired tiger.', [true, true]], results)

	// Failed match.
	results = differ.patch_apply(patches, 'I am the very model of a modern major general.')
	assertEquals(['I am the very model of a modern major general.', [false, false]], results)

	// Big delete, small change.
	patches = differ.patch_make('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
	results = differ.patch_apply(
		patches,
		'x123456789012345678901234567890-----++++++++++-----123456789012345678901234567890y',
	)
	assertEquals(['xabcy', [true, true]], results)

	// Big delete, big change 1.
	patches = differ.patch_make('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
	results = differ.patch_apply(
		patches,
		'x12345678901234567890---------------++++++++++---------------12345678901234567890y',
	)
	assertEquals(['xabc12345678901234567890---------------++++++++++---------------12345678901234567890y', [
		false,
		true,
	]], results)

	// Big delete, big change 2.
	differ.Patch_DeleteThreshold = 0.6
	patches = differ.patch_make('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
	results = differ.patch_apply(
		patches,
		'x12345678901234567890---------------++++++++++---------------12345678901234567890y',
	)
	assertEquals(['xabcy', [true, true]], results)
	differ.Patch_DeleteThreshold = 0.5

	// Compensate for failed patch.
	differ.Match_Threshold = 0.0
	differ.Match_Distance = 0
	patches = differ.patch_make(
		'abcdefghijklmnopqrstuvwxyz--------------------1234567890',
		'abcXXXXXXXXXXdefghijklmnopqrstuvwxyz--------------------1234567YYYYYYYYYY890',
	)
	results = differ.patch_apply(patches, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ--------------------1234567890')
	assertEquals(['ABCDEFGHIJKLMNOPQRSTUVWXYZ--------------------1234567YYYYYYYYYY890', [false, true]], results)
	differ.Match_Threshold = 0.5
	differ.Match_Distance = 1000

	// No side effects.
	patches = differ.patch_make('', 'test')
	let patchstr = differ.patch_toText(patches)
	differ.patch_apply(patches, '')
	assertEquals(patchstr, differ.patch_toText(patches))

	// No side effects with major delete.
	patches = differ.patch_make('The quick brown fox jumps over the lazy dog.', 'Woof')
	patchstr = differ.patch_toText(patches)
	differ.patch_apply(patches, 'The quick brown fox jumps over the lazy dog.')
	assertEquals(patchstr, differ.patch_toText(patches))

	// Edge exact match.
	patches = differ.patch_make('', 'test')
	results = differ.patch_apply(patches, '')
	assertEquals(['test', [true]], results)

	// Near edge exact match.
	patches = differ.patch_make('XY', 'XtestY')
	results = differ.patch_apply(patches, 'XY')
	assertEquals(['XtestY', [true]], results)

	// Edge partial match.
	patches = differ.patch_make('y', 'y123')
	results = differ.patch_apply(patches, 'x')
	assertEquals(['x123', [true]], results)
})

Deno.test('diff', async (t) => {
	await t.step('chars', () => {
		assertDiffsEqual(
			[[-1, 'abc'], [0, 'd'], [1, 'efg']],
			differ.diff('abcd', 'defg'),
		)
	})

	await t.step('non-BMP', async (t) => {
		await t.step('emojis', () => {
			assertDiffsEqual(
				[[-1, '💫'], [1, '💩']],
				differ.diff('💫', '💩'),
			)
		})

		await t.step('can opt into old code unit behavior', () => {
			const segmenter = (str: string) => str.split('')

			assertDiffsEqual(
				[[0, '\ud83d'], [-1, '\udcab'], [1, '\udca9']],
				differ.diff('💫', '💩', { segmenter }),
			)

			assertEquals(
				differ.diff_main('💫', '💩'),
				differ.diff('💫', '💩', { segmenter }),
			)
		})
	})

	await t.step('words', async (t) => {
		await t.step('default word segmenter', () => {
			assertDiffsEqual(
				[[-1, 'Hello'], [1, 'Goodbye'], [0, ', world!']],
				differ.diff('Hello, world!', 'Goodbye, world!', { segmenter: segmenters.word }),
			)
		})

		await t.step('xml', () => {
			assertDiffsEqual(
				[[0, '<book price="'], [-1, '4.99'], [1, '7.99'], [0, '" />']],
				differ.diff('<book price="4.99" />', '<book price="7.99" />', { segmenter: segmenters.word }),
			)

			assertDiffsEqual(
				[[0, '<book price="'], [-1, '4.99'], [1, '7.99'], [0, '" />']],
				differ.diff('<book price="4.99" />', '<book price="7.99" />', { segmenter: segmenters.word }),
			)
		})

		await t.step('custom word segmenter', () => {
			const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })

			assertDiffsEqual(
				[[0, '两只'], [-1, '小蜜蜂'], [1, '老虎']],
				differ.diff('两只小蜜蜂', '两只老虎', { segmenter }),
			)
		})
	})

	await t.step('parity with line diff function from docs', () => {
		// https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs

		function diffLineMode(text1: string, text2: string) {
			const differ = new Differ()
			const { chars1, chars2, lineArray } = differ['diff_linesToChars_'](text1, text2)
			const diffs = differ.diff_main(chars1, chars2, false)
			differ['diff_charsToLines_'](diffs, lineArray)

			return diffs
		}

		const str1 = '11\n12\n13\n14\n15'
		const str2 = '11\n12\n14\n15'

		assertEquals(
			diffLineMode(str1, str2),
			differ.diff(str1, str2, { segmenter: segmenters.line }),
		)
	})
})

Deno.test('diffWithin', async (t) => {
	await t.step('chars', () => {
		const text1 = `Line One
Line Two
Line Three
`
		const text2 = `Line One
Line 2
Line Three
Line Four
Line Five
`

		const diffs = differ.diff(text1, text2, {
			segmenter: segmenters.line,
			join: false,
		})

		const d = differ.diffWithin(diffs, {
			segmenter: segmenters.word,
		})

		assertEquals(
			d,
			[
				new Diff(0, 'Line One\n'),
				[
					new Diff(0, 'Line '),
					new Diff(-1, 'Two'),
					new Diff(1, '2'),
					new Diff(0, '\n'),
				],
				new Diff(0, 'Line Three\n'),
				new Diff(1, 'Line Four\n'),
				new Diff(1, 'Line Five\n'),
			],
		)
	})
})
