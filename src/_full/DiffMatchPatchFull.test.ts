import { assert, assertEquals } from '@std/assert'
import { DiffMatchPatchFull as DiffMatchPatch } from './DiffMatchPatchFull.ts'
import { Diff, DiffOperation } from '../Diff.ts'
import { Patch } from './Patch.ts'
import { assertDiffsEqual } from '../_testUtils.ts'
import { makeDiffs } from '../utils.ts'

// Tests here are modified from `google/diff-match-patch` tests
// to ensure parity after the various refactoring (ESM, classes, TS, etc.)

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

const dmp = new DiffMatchPatch()

Deno.test(dmp.diff_commonPrefix.name, () => {
	// Detect any common prefix.
	// Null case.
	assertEquals(0, dmp.diff_commonPrefix('abc', 'xyz'))

	// Non-null case.
	assertEquals(4, dmp.diff_commonPrefix('1234abcdef', '1234xyz'))

	// Whole case.
	assertEquals(4, dmp.diff_commonPrefix('1234', '1234xyz'))
})

Deno.test(dmp.diff_commonSuffix.name, () => {
	// Detect any common suffix.
	// Null case.
	assertEquals(0, dmp.diff_commonSuffix('abc', 'xyz'))

	// Non-null case.
	assertEquals(4, dmp.diff_commonSuffix('abcdef1234', 'xyz1234'))

	// Whole case.
	assertEquals(4, dmp.diff_commonSuffix('1234', 'xyz1234'))
})

Deno.test(dmp['diff_commonOverlap_'].name, () => {
	// Detect any suffix/prefix overlap.
	// Null case.
	assertEquals(0, dmp['diff_commonOverlap_']('', 'abcd'))

	// Whole case.
	assertEquals(3, dmp['diff_commonOverlap_']('abc', 'abcd'))

	// No overlap.
	assertEquals(0, dmp['diff_commonOverlap_']('123456', 'abcd'))

	// Overlap.
	assertEquals(3, dmp['diff_commonOverlap_']('123456xxx', 'xxxabcd'))

	// Unicode.
	// Some overly clever languages (C#) may treat ligatures as equal to their
	// component letters.  E.g. U+FB01 == 'fi'
	assertEquals(0, dmp['diff_commonOverlap_']('fi', '\ufb01i'))
})

Deno.test(dmp['diff_halfMatch_'].name, () => {
	// Detect a halfmatch.
	dmp.Diff_Timeout = 1
	// No match.
	assertEquals(null, dmp['diff_halfMatch_']('1234567890', 'abcdef'))

	assertEquals(null, dmp['diff_halfMatch_']('12345', '23'))

	// Single Match.
	assertEquals(['12', '90', 'a', 'z', '345678'], dmp['diff_halfMatch_']('1234567890', 'a345678z'))

	assertEquals(['a', 'z', '12', '90', '345678'], dmp['diff_halfMatch_']('a345678z', '1234567890'))

	assertEquals(['abc', 'z', '1234', '0', '56789'], dmp['diff_halfMatch_']('abc56789z', '1234567890'))

	assertEquals(['a', 'xyz', '1', '7890', '23456'], dmp['diff_halfMatch_']('a23456xyz', '1234567890'))

	// Multiple Matches.
	assertEquals(
		['12123', '123121', 'a', 'z', '1234123451234'],
		dmp['diff_halfMatch_']('121231234123451234123121', 'a1234123451234z'),
	)

	assertEquals(
		['', '-=-=-=-=-=', 'x', '', 'x-=-=-=-=-=-=-='],
		dmp['diff_halfMatch_']('x-=-=-=-=-=-=-=-=-=-=-=-=', 'xx-=-=-=-=-=-=-='),
	)

	assertEquals(
		['-=-=-=-=-=', '', '', 'y', '-=-=-=-=-=-=-=y'],
		dmp['diff_halfMatch_']('-=-=-=-=-=-=-=-=-=-=-=-=y', '-=-=-=-=-=-=-=yy'),
	)

	// Non-optimal halfmatch.
	// Optimal diff would be -q+x=H-i+e=lloHe+Hu=llo-Hew+y not -qHillo+x=HelloHe-w+Hulloy
	assertEquals(['qHillo', 'w', 'x', 'Hulloy', 'HelloHe'], dmp['diff_halfMatch_']('qHilloHelloHew', 'xHelloHeHulloy'))

	// Optimal no halfmatch.
	dmp.Diff_Timeout = 0
	assertEquals(null, dmp['diff_halfMatch_']('qHilloHelloHew', 'xHelloHeHulloy'))
})

Deno.test(dmp['diff_linesToChars_'].name, () => {
	function assertLinesToCharsResultEquals(
		a: ReturnType<typeof dmp['diff_linesToChars_']>,
		b: ReturnType<typeof dmp['diff_linesToChars_']>,
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
	}, dmp['diff_linesToChars_']('alpha\nbeta\nalpha\n', 'beta\nalpha\nbeta\n'))

	assertLinesToCharsResultEquals({
		chars1: '',
		chars2: '\x01\x02\x03\x03',
		lineArray: ['', 'alpha\r\n', 'beta\r\n', '\r\n'],
	}, dmp['diff_linesToChars_']('', 'alpha\r\nbeta\r\n\r\n\r\n'))

	assertLinesToCharsResultEquals(
		{ chars1: '\x01', chars2: '\x02', lineArray: ['', 'a', 'b'] },
		dmp['diff_linesToChars_']('a', 'b'),
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
		dmp['diff_linesToChars_'](lines, ''),
	)
})

Deno.test(`${dmp['diff_charsToLines_'].name} and ${dmp['diff_linesToChars_'].name}`, () => {
	// Convert chars up to lines.
	let diffs = makeDiffs([[DiffOperation.Equal, '\x01\x02\x01'], [DiffOperation.Insert, '\x02\x01\x02']])

	dmp['diff_charsToLines_'](diffs, ['', 'alpha\n', 'beta\n'])
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
	dmp['diff_charsToLines_'](diffs, lineList)
	assertEquals([new Diff(DiffOperation.Delete, lines)], diffs)

	// More than 65536 to verify any 16-bit limitation.
	lineList = []
	for (let i = 0; i < 66000; i++) {
		lineList[i] = i + '\n'
	}
	chars = lineList.join('')
	const results = dmp['diff_linesToChars_'](chars, '')
	diffs = [new Diff(DiffOperation.Insert, results.chars1)]
	dmp['diff_charsToLines_'](diffs, results.lineArray)
	assertEquals(chars, diffs[0][1])
})

Deno.test(dmp.diff_cleanupMerge.name, () => {
	// Cleanup a messy diff.
	// Null case.
	let diffs: Diff[] = []
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([], diffs)

	// No change case.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Insert, 'c']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Insert, 'c']],
		diffs,
	)

	// Merge equalities.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Equal, 'b'], [DiffOperation.Equal, 'c']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'abc']], diffs)

	// Merge deletions.
	diffs = makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Delete, 'c']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abc']], diffs)

	// Merge insertions.
	diffs = makeDiffs([[DiffOperation.Insert, 'a'], [DiffOperation.Insert, 'b'], [DiffOperation.Insert, 'c']])
	dmp.diff_cleanupMerge(diffs)
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
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'ac'], [DiffOperation.Insert, 'bd'], [DiffOperation.Equal, 'ef']],
		diffs,
	)

	// Prefix and suffix detection.
	diffs = makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Insert, 'abc'], [DiffOperation.Delete, 'dc']])
	dmp.diff_cleanupMerge(diffs)
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
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'xa'], [DiffOperation.Delete, 'd'], [DiffOperation.Insert, 'b'], [
			DiffOperation.Equal,
			'cy',
		]],
		diffs,
	)

	// Slide edit left.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Insert, 'ba'], [DiffOperation.Equal, 'c']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'ab'], [DiffOperation.Equal, 'ac']], diffs)

	// Slide edit right.
	diffs = makeDiffs([[DiffOperation.Equal, 'c'], [DiffOperation.Insert, 'ab'], [DiffOperation.Equal, 'a']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'ca'], [DiffOperation.Insert, 'ba']], diffs)

	// Slide edit left recursive.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'b'], [DiffOperation.Equal, 'c'], [
		DiffOperation.Delete,
		'ac',
	], [DiffOperation.Equal, 'x']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abc'], [DiffOperation.Equal, 'acx']], diffs)

	// Slide edit right recursive.
	diffs = makeDiffs([[DiffOperation.Equal, 'x'], [DiffOperation.Delete, 'ca'], [DiffOperation.Equal, 'c'], [
		DiffOperation.Delete,
		'b',
	], [DiffOperation.Equal, 'a']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'xca'], [DiffOperation.Delete, 'cba']], diffs)

	// Empty merge.
	diffs = makeDiffs([[DiffOperation.Delete, 'b'], [DiffOperation.Insert, 'ab'], [DiffOperation.Equal, 'c']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'a'], [DiffOperation.Equal, 'bc']], diffs)

	// Empty equality.
	diffs = makeDiffs([[DiffOperation.Equal, ''], [DiffOperation.Insert, 'a'], [DiffOperation.Equal, 'b']])
	dmp.diff_cleanupMerge(diffs)
	assertDiffsEqual([[DiffOperation.Insert, 'a'], [DiffOperation.Equal, 'b']], diffs)
})

Deno.test(dmp.diff_cleanupSemanticLossless.name, () => {
	// Slide diffs to match logical boundaries.
	// Null case.
	let diffs: Diff[] = []
	dmp.diff_cleanupSemanticLossless(diffs)
	assertEquals([], diffs)

	// Blank lines.
	diffs = makeDiffs([[DiffOperation.Equal, 'AAA\r\n\r\nBBB'], [DiffOperation.Insert, '\r\nDDD\r\n\r\nBBB'], [
		DiffOperation.Equal,
		'\r\nEEE',
	]])
	dmp.diff_cleanupSemanticLossless(diffs)
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
	dmp.diff_cleanupSemanticLossless(diffs)
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
	dmp.diff_cleanupSemanticLossless(diffs)
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
	dmp.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The-'], [DiffOperation.Insert, 'cow-and-the-'], [
			DiffOperation.Equal,
			'cat.',
		]],
		diffs,
	)

	// Hitting the start.
	diffs = makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'ax']])
	dmp.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'aax']], diffs)

	// Hitting the end.
	diffs = makeDiffs([[DiffOperation.Equal, 'xa'], [DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'a']])
	dmp.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual([[DiffOperation.Equal, 'xaa'], [DiffOperation.Delete, 'a']], diffs)

	// Sentence boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'The xxx. The '], [DiffOperation.Insert, 'zzz. The '], [
		DiffOperation.Equal,
		'yyy.',
	]])
	dmp.diff_cleanupSemanticLossless(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The xxx.'], [DiffOperation.Insert, ' The zzz.'], [
			DiffOperation.Equal,
			' The yyy.',
		]],
		diffs,
	)
})

Deno.test(dmp.diff_cleanupSemantic.name, () => {
	// Cleanup semantically trivial equalities.
	// Null case.
	let diffs: Diff[] = []
	dmp.diff_cleanupSemantic(diffs)
	assertEquals([], diffs)

	// No elimination #1.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, 'cd'], [DiffOperation.Equal, '12'], [
		DiffOperation.Delete,
		'e',
	]])
	dmp.diff_cleanupSemantic(diffs)
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
	dmp.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, 'ABC'], [DiffOperation.Equal, '1234'], [
			DiffOperation.Delete,
			'wxyz',
		]],
		diffs,
	)

	// Simple elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Equal, 'b'], [DiffOperation.Delete, 'c']])
	dmp.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, 'b']], diffs)

	// Backpass elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Equal, 'cd'], [DiffOperation.Delete, 'e'], [
		DiffOperation.Equal,
		'f',
	], [DiffOperation.Insert, 'g']])
	dmp.diff_cleanupSemantic(diffs)
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
	dmp.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'AB_AB'], [DiffOperation.Insert, '1A2_1A2']], diffs)

	// Word boundaries.
	diffs = makeDiffs([[DiffOperation.Equal, 'The c'], [DiffOperation.Delete, 'ow and the c'], [
		DiffOperation.Equal,
		'at.',
	]])
	dmp.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Equal, 'The '], [DiffOperation.Delete, 'cow and the '], [
			DiffOperation.Equal,
			'cat.',
		]],
		diffs,
	)

	// No overlap elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'abcxx'], [DiffOperation.Insert, 'xxdef']])
	dmp.diff_cleanupSemantic(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abcxx'], [DiffOperation.Insert, 'xxdef']], diffs)

	// Overlap elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'abcxxx'], [DiffOperation.Insert, 'xxxdef']])
	dmp.diff_cleanupSemantic(diffs)
	assertDiffsEqual(
		[[DiffOperation.Delete, 'abc'], [DiffOperation.Equal, 'xxx'], [DiffOperation.Insert, 'def']],
		diffs,
	)

	// Reverse overlap elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'xxxabc'], [DiffOperation.Insert, 'defxxx']])
	dmp.diff_cleanupSemantic(diffs)
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
	dmp.diff_cleanupSemantic(diffs)
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

Deno.test(dmp.diff_cleanupEfficiency.name, () => {
	// Cleanup operationally trivial equalities.
	dmp.Diff_EditCost = 4
	// Null case.
	let diffs: Diff[] = []
	dmp.diff_cleanupEfficiency(diffs)
	assertEquals([], diffs)

	// No elimination.
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, '12'], [DiffOperation.Equal, 'wxyz'], [
		DiffOperation.Delete,
		'cd',
	], [DiffOperation.Insert, '34']])
	dmp.diff_cleanupEfficiency(diffs)
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
	dmp.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abxyzcd'], [DiffOperation.Insert, '12xyz34']], diffs)

	// Three-edit elimination.
	diffs = makeDiffs([[DiffOperation.Insert, '12'], [DiffOperation.Equal, 'x'], [DiffOperation.Delete, 'cd'], [
		DiffOperation.Insert,
		'34',
	]])
	dmp.diff_cleanupEfficiency(diffs)
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
	dmp.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abxyzcd'], [DiffOperation.Insert, '12xy34z56']], diffs)

	// High cost elimination.
	dmp.Diff_EditCost = 5
	diffs = makeDiffs([[DiffOperation.Delete, 'ab'], [DiffOperation.Insert, '12'], [DiffOperation.Equal, 'wxyz'], [
		DiffOperation.Delete,
		'cd',
	], [DiffOperation.Insert, '34']])
	dmp.diff_cleanupEfficiency(diffs)
	assertDiffsEqual([[DiffOperation.Delete, 'abwxyzcd'], [DiffOperation.Insert, '12wxyz34']], diffs)
	dmp.Diff_EditCost = 4
})

Deno.test(dmp.diff_prettyHtml.name, () => {
	// Pretty print.
	const diffs = makeDiffs([[DiffOperation.Equal, 'a\n'], [DiffOperation.Delete, '<B>b</B>'], [
		DiffOperation.Insert,
		'c&d',
	]])
	assertEquals(
		'<span>a&para;<br></span><del style="background:#ffe6e6;">&lt;B&gt;b&lt;/B&gt;</del><ins style="background:#e6ffe6;">c&amp;d</ins>',
		dmp.diff_prettyHtml(diffs),
	)
})

Deno.test(`${dmp['diff_text1'].name} and ${dmp['diff_text2'].name}`, () => {
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
	assertEquals('jumps over the lazy', dmp.diff_text1(diffs))

	assertEquals('jumped over a lazy', dmp.diff_text2(diffs))
})

Deno.test(`${dmp.diff_toDelta.name} and ${dmp.diff_fromDelta.name}`, () => {
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
	let text1 = dmp.diff_text1(diffs)
	assertEquals('jumps over the lazy', text1)

	let delta = dmp.diff_toDelta(diffs)
	assertEquals('=4\t-1\t+ed\t=6\t-3\t+a\t=5\t+old dog', delta)

	// Convert delta string into a diff.
	assertEquals(diffs, dmp.diff_fromDelta(text1, delta))

	// Generates error (19 != 20).
	try {
		dmp.diff_fromDelta(text1 + 'x', delta)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}

	// Generates error (19 != 18).
	try {
		dmp.diff_fromDelta(text1.substring(1), delta)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}

	// Generates error (%c3%xy invalid Unicode).
	try {
		dmp.diff_fromDelta('', '+%c3%xy')
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}

	// Test deltas with special characters.
	diffs = makeDiffs([[DiffOperation.Equal, '\u0680 \x00 \t %'], [DiffOperation.Delete, '\u0681 \x01 \n ^'], [
		DiffOperation.Insert,
		'\u0682 \x02 \\ |',
	]])
	text1 = dmp.diff_text1(diffs)
	assertEquals('\u0680 \x00 \t %\u0681 \x01 \n ^', text1)

	delta = dmp.diff_toDelta(diffs)
	assertEquals('=7\t-7\t+%DA%82 %02 %5C %7C', delta)

	// Convert delta string into a diff.
	assertEquals(diffs, dmp.diff_fromDelta(text1, delta))

	// Verify pool of unchanged characters.
	diffs = makeDiffs([[DiffOperation.Insert, "A-Z a-z 0-9 - _ . ! ~ * ' ( ) ; / ? : @ & = + $ , # "]])
	const text2 = dmp.diff_text2(diffs)
	assertEquals("A-Z a-z 0-9 - _ . ! ~ * ' ( ) ; / ? : @ & = + $ , # ", text2)

	delta = dmp.diff_toDelta(diffs)
	assertEquals("+A-Z a-z 0-9 - _ . ! ~ * ' ( ) ; / ? : @ & = + $ , # ", delta)

	// Convert delta string into a diff.
	assertEquals(diffs, dmp.diff_fromDelta('', delta))

	// 160 kb string.
	let a = 'abcdefghij'
	for (let i = 0; i < 14; i++) {
		a += a
	}
	diffs = makeDiffs([[DiffOperation.Insert, a]])
	delta = dmp.diff_toDelta(diffs)
	assertEquals('+' + a, delta)

	// Convert delta string into a diff.
	assertEquals(diffs, dmp.diff_fromDelta('', delta))
})

Deno.test(dmp.diff_xIndex.name, () => {
	// Translate a location in text1 to text2.
	// Translation on equality.
	assertEquals(
		5,
		dmp.diff_xIndex(
			makeDiffs([[DiffOperation.Delete, 'a'], [DiffOperation.Insert, '1234'], [DiffOperation.Equal, 'xyz']]),
			2,
		),
	)

	// Translation on deletion.
	assertEquals(
		1,
		dmp.diff_xIndex(
			makeDiffs([[DiffOperation.Equal, 'a'], [DiffOperation.Delete, '1234'], [DiffOperation.Equal, 'xyz']]),
			3,
		),
	)
})

Deno.test(dmp.diff_levenshtein.name, () => {
	// Levenshtein with trailing equality.
	assertEquals(
		4,
		dmp.diff_levenshtein(makeDiffs([[DiffOperation.Delete, 'abc'], [DiffOperation.Insert, '1234'], [
			DiffOperation.Equal,
			'xyz',
		]])),
	)
	// Levenshtein with leading equality.
	assertEquals(
		4,
		dmp.diff_levenshtein(makeDiffs([[DiffOperation.Equal, 'xyz'], [DiffOperation.Delete, 'abc'], [
			DiffOperation.Insert,
			'1234',
		]])),
	)
	// Levenshtein with middle equality.
	assertEquals(
		7,
		dmp.diff_levenshtein(makeDiffs([[DiffOperation.Delete, 'abc'], [DiffOperation.Equal, 'xyz'], [
			DiffOperation.Insert,
			'1234',
		]])),
	)
})

Deno.test(dmp['diff_bisect_'].name, () => {
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
		dmp['diff_bisect_'](a, b, Number.MAX_VALUE),
	)

	// Timeout.
	assertDiffsEqual(
		[[DiffOperation.Delete, 'cat'], [DiffOperation.Insert, 'map']],
		dmp['diff_bisect_'](a, b, 0),
	)
})

Deno.test(dmp.diff_main.name, () => {
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
	assertEquals([], dmp.diff_main('', '', false))

	// Equality.
	assertDiffsEqual([[DiffOperation.Equal, 'abc']], dmp.diff_main('abc', 'abc', false))

	// Simple insertion.
	assertDiffsEqual(
		[[DiffOperation.Equal, 'ab'], [DiffOperation.Insert, '123'], [DiffOperation.Equal, 'c']],
		dmp.diff_main('abc', 'ab123c', false),
	)

	// Simple deletion.
	assertDiffsEqual(
		[[DiffOperation.Equal, 'a'], [DiffOperation.Delete, '123'], [DiffOperation.Equal, 'bc']],
		dmp.diff_main('a123bc', 'abc', false),
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
		dmp.diff_main('abc', 'a123b456c', false),
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
		dmp.diff_main('a123b456c', 'abc', false),
	)

	// Perform a real diff.
	// Switch off the timeout.
	dmp.Diff_Timeout = 0
	// Simple cases.
	assertDiffsEqual([[DiffOperation.Delete, 'a'], [DiffOperation.Insert, 'b']], dmp.diff_main('a', 'b', false))

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
		dmp.diff_main('Apples are a fruit.', 'Bananas are also fruit.', false),
	)

	assertDiffsEqual(
		[[DiffOperation.Delete, 'a'], [DiffOperation.Insert, '\u0680'], [DiffOperation.Equal, 'x'], [
			DiffOperation.Delete,
			'\t',
		], [
			DiffOperation.Insert,
			'\0',
		]],
		dmp.diff_main('ax\t', '\u0680x\0', false),
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
		dmp.diff_main('1ayb2', 'abxab', false),
	)

	assertDiffsEqual(
		[[DiffOperation.Insert, 'xaxcx'], [DiffOperation.Equal, 'abc'], [DiffOperation.Delete, 'y']],
		dmp.diff_main('abcy', 'xaxcxabc', false),
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
		dmp.diff_main('ABCDa=bcd=efghijklmnopqrsEFGHIJKLMNOefg', 'a-bcd-efghijklmnopqrs', false),
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
		dmp.diff_main('a [[Pennsylvania]] and [[New', ' and [[Pennsylvania]]', false),
	)

	// Timeout.
	dmp.Diff_Timeout = 0.1 // 100ms
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
	dmp.diff_main(a, b)
	const endTime = (new Date()).getTime()
	// Test that we took at least the timeout period.
	assert(dmp.Diff_Timeout * 1000 <= endTime - startTime)
	// Test that we didn't take forever (be forgiving).
	// Theoretically this test could fail very occasionally if the
	// OS task swaps or locks up for a second at the wrong moment.
	assert(dmp.Diff_Timeout * 1000 * 2 > endTime - startTime)
	dmp.Diff_Timeout = 0

	// Test the linemode speedup.
	// Must be long to pass the 100 char cutoff.
	// Simple line-mode.
	a = '1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n'
	b = 'abcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\n'
	assertEquals(dmp.diff_main(a, b, false), dmp.diff_main(a, b, true))

	// Single line-mode.
	a = '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890'
	b = 'abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij'
	assertEquals(dmp.diff_main(a, b, false), dmp.diff_main(a, b, true))

	// Overlap line-mode.
	a = '1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n'
	b = 'abcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n'
	const texts_linemode = diff_rebuildtexts(dmp.diff_main(a, b, true))
	const texts_textmode = diff_rebuildtexts(dmp.diff_main(a, b, false))
	assertEquals(texts_textmode, texts_linemode)

	// Test null inputs.
	try {
		// @ts-expect-error null not allowed
		dmp.diff_main(null, null)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

// MATCH TEST FUNCTIONS

Deno.test(dmp['match_alphabet_'].name, () => {
	// Initialise the bitmasks for Bitap.
	// Unique.
	assertEquals({ 'a': 4, 'b': 2, 'c': 1 }, dmp['match_alphabet_']('abc'))

	// Duplicates.
	assertEquals({ 'a': 37, 'b': 18, 'c': 8 }, dmp['match_alphabet_']('abcaba'))
})

Deno.test(dmp['match_bitap_'].name, () => {
	// Bitap algorithm.
	dmp.Match_Distance = 100
	dmp.Match_Threshold = 0.5
	// Exact matches.
	assertEquals(5, dmp['match_bitap_']('abcdefghijk', 'fgh', 5))

	assertEquals(5, dmp['match_bitap_']('abcdefghijk', 'fgh', 0))

	// Fuzzy matches.
	assertEquals(4, dmp['match_bitap_']('abcdefghijk', 'efxhi', 0))

	assertEquals(2, dmp['match_bitap_']('abcdefghijk', 'cdefxyhijk', 5))

	assertEquals(-1, dmp['match_bitap_']('abcdefghijk', 'bxy', 1))

	// Overflow.
	assertEquals(2, dmp['match_bitap_']('123456789xx0', '3456789x0', 2))

	// Threshold test.
	dmp.Match_Threshold = 0.4
	assertEquals(4, dmp['match_bitap_']('abcdefghijk', 'efxyhi', 1))

	dmp.Match_Threshold = 0.3
	assertEquals(-1, dmp['match_bitap_']('abcdefghijk', 'efxyhi', 1))

	dmp.Match_Threshold = 0.0
	assertEquals(1, dmp['match_bitap_']('abcdefghijk', 'bcdef', 1))
	dmp.Match_Threshold = 0.5

	// Multiple select.
	assertEquals(0, dmp['match_bitap_']('abcdexyzabcde', 'abccde', 3))

	assertEquals(8, dmp['match_bitap_']('abcdexyzabcde', 'abccde', 5))

	// Distance test.
	dmp.Match_Distance = 10 // Strict location.
	assertEquals(-1, dmp['match_bitap_']('abcdefghijklmnopqrstuvwxyz', 'abcdefg', 24))

	assertEquals(0, dmp['match_bitap_']('abcdefghijklmnopqrstuvwxyz', 'abcdxxefg', 1))

	dmp.Match_Distance = 1000 // Loose location.
	assertEquals(0, dmp['match_bitap_']('abcdefghijklmnopqrstuvwxyz', 'abcdefg', 24))
})

Deno.test(dmp.match_main.name, () => {
	// Full match.
	// Shortcut matches.
	assertEquals(0, dmp.match_main('abcdef', 'abcdef', 1000))

	assertEquals(-1, dmp.match_main('', 'abcdef', 1))

	assertEquals(3, dmp.match_main('abcdef', '', 3))

	assertEquals(3, dmp.match_main('abcdef', 'de', 3))

	// Beyond end match.
	assertEquals(3, dmp.match_main('abcdef', 'defy', 4))

	// Oversized pattern.
	assertEquals(0, dmp.match_main('abcdef', 'abcdefy', 0))

	// Complex match.
	assertEquals(4, dmp.match_main('I am the very model of a modern major general.', ' that berry ', 5))

	// Test null inputs.
	try {
		// @ts-expect-error null not allowed
		dmp.match_main(null, null, 0)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

// PATCH TEST FUNCTIONS

Deno.test(Patch.name, () => {
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

Deno.test(dmp.patch_fromText.name, () => {
	assertEquals([], dmp.patch_fromText(''))
	// @ts-expect-error null
	assertEquals([], dmp.patch_fromText(null))
	// @ts-expect-error undefined
	assertEquals([], dmp.patch_fromText(undefined))

	const strp = '@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n %0Alaz\n'

	assertEquals(strp, dmp.patch_fromText(strp)[0].toString())

	assertEquals('@@ -1 +1 @@\n-a\n+b\n', dmp.patch_fromText('@@ -1 +1 @@\n-a\n+b\n')[0].toString())

	assertEquals('@@ -1,3 +0,0 @@\n-abc\n', dmp.patch_fromText('@@ -1,3 +0,0 @@\n-abc\n')[0].toString())

	assertEquals('@@ -0,0 +1,3 @@\n+abc\n', dmp.patch_fromText('@@ -0,0 +1,3 @@\n+abc\n')[0].toString())

	// Generates error.
	try {
		dmp.patch_fromText('Bad\nPatch\n')
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

Deno.test(dmp.patch_toText.name, () => {
	let strp = '@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n  laz\n'
	let p = dmp.patch_fromText(strp)
	assertEquals(strp, dmp.patch_toText(p))

	strp = '@@ -1,9 +1,9 @@\n-f\n+F\n oo+fooba\n@@ -7,9 +7,9 @@\n obar\n-,\n+.\n  tes\n'
	p = dmp.patch_fromText(strp)
	assertEquals(strp, dmp.patch_toText(p))
})

Deno.test(dmp['patch_addContext_'].name, () => {
	dmp.Patch_Margin = 4
	let p = dmp.patch_fromText('@@ -21,4 +21,10 @@\n-jump\n+somersault\n')[0]
	dmp['patch_addContext_'](p, 'The quick brown fox jumps over the lazy dog.')
	assertEquals('@@ -17,12 +17,18 @@\n fox \n-jump\n+somersault\n s ov\n', p.toString())

	// Same, but not enough trailing context.
	p = dmp.patch_fromText('@@ -21,4 +21,10 @@\n-jump\n+somersault\n')[0]
	dmp['patch_addContext_'](p, 'The quick brown fox jumps.')
	assertEquals('@@ -17,10 +17,16 @@\n fox \n-jump\n+somersault\n s.\n', p.toString())

	// Same, but not enough leading context.
	p = dmp.patch_fromText('@@ -3 +3,2 @@\n-e\n+at\n')[0]
	dmp['patch_addContext_'](p, 'The quick brown fox jumps.')
	assertEquals('@@ -1,7 +1,8 @@\n Th\n-e\n+at\n  qui\n', p.toString())

	// Same, but with ambiguity.
	p = dmp.patch_fromText('@@ -3 +3,2 @@\n-e\n+at\n')[0]
	dmp['patch_addContext_'](p, 'The quick brown fox jumps.  The quick brown fox crashes.')
	assertEquals('@@ -1,27 +1,28 @@\n Th\n-e\n+at\n  quick brown fox jumps. \n', p.toString())
})

Deno.test(dmp.patch_make.name, () => {
	// Null case.
	let patches = dmp.patch_make('', '')
	assertEquals('', dmp.patch_toText(patches))

	let text1 = 'The quick brown fox jumps over the lazy dog.'
	let text2 = 'That quick brown fox jumped over a lazy dog.'
	// Text2+Text1 inputs.
	let expectedPatch =
		'@@ -1,8 +1,7 @@\n Th\n-at\n+e\n  qui\n@@ -21,17 +21,18 @@\n jump\n-ed\n+s\n  over \n-a\n+the\n  laz\n'
	// The second patch must be "-21,17 +21,18", not "-22,17 +21,18" due to rolling context.
	patches = dmp.patch_make(text2, text1)
	assertEquals(expectedPatch, dmp.patch_toText(patches))

	// Text1+Text2 inputs.
	expectedPatch =
		'@@ -1,11 +1,12 @@\n Th\n-e\n+at\n  quick b\n@@ -22,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n  laz\n'
	patches = dmp.patch_make(text1, text2)
	assertEquals(expectedPatch, dmp.patch_toText(patches))

	// Diff input.
	let diffs = dmp.diff_main(text1, text2, false)
	patches = dmp.patch_make(diffs)
	assertEquals(expectedPatch, dmp.patch_toText(patches))

	// Text1+Diff inputs.
	patches = dmp.patch_make(text1, diffs)
	assertEquals(expectedPatch, dmp.patch_toText(patches))

	// Text1+Text2+Diff inputs (deprecated).
	patches = dmp.patch_make(text1, text2, diffs)
	assertEquals(expectedPatch, dmp.patch_toText(patches))

	// Character encoding.
	patches = dmp.patch_make("`1234567890-=[]\\;',./", '~!@#$%^&*()_+{}|:"<>?')
	assertEquals(
		"@@ -1,21 +1,21 @@\n-%601234567890-=%5B%5D%5C;',./\n+~!@#$%25%5E&*()_+%7B%7D%7C:%22%3C%3E?\n",
		dmp.patch_toText(patches),
	)

	// Character decoding.
	diffs = makeDiffs([[DiffOperation.Delete, "`1234567890-=[]\\;',./"], [
		DiffOperation.Insert,
		'~!@#$%^&*()_+{}|:"<>?',
	]])
	assertEquals(
		diffs,
		dmp.patch_fromText(
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
	patches = dmp.patch_make(text1, text2)
	assertEquals(expectedPatch, dmp.patch_toText(patches))

	// Test null inputs.
	try {
		// @ts-expect-error null
		dmp.patch_make(null)
		assertEquals(Error, null)
	} catch (_e) {
		// Exception expected.
	}
})

Deno.test(dmp.patch_splitMax.name, () => {
	// Assumes that dmp.Match_MaxBits is 32.
	let patches = dmp.patch_make(
		'abcdefghijklmnopqrstuvwxyz01234567890',
		'XabXcdXefXghXijXklXmnXopXqrXstXuvXwxXyzX01X23X45X67X89X0',
	)
	dmp.patch_splitMax(patches)
	assertEquals(
		'@@ -1,32 +1,46 @@\n+X\n ab\n+X\n cd\n+X\n ef\n+X\n gh\n+X\n ij\n+X\n kl\n+X\n mn\n+X\n op\n+X\n qr\n+X\n st\n+X\n uv\n+X\n wx\n+X\n yz\n+X\n 012345\n@@ -25,13 +39,18 @@\n zX01\n+X\n 23\n+X\n 45\n+X\n 67\n+X\n 89\n+X\n 0\n',
		dmp.patch_toText(patches),
	)

	patches = dmp.patch_make(
		'abcdef1234567890123456789012345678901234567890123456789012345678901234567890uvwxyz',
		'abcdefuvwxyz',
	)
	const oldToText = dmp.patch_toText(patches)
	dmp.patch_splitMax(patches)
	assertEquals(oldToText, dmp.patch_toText(patches))

	patches = dmp.patch_make('1234567890123456789012345678901234567890123456789012345678901234567890', 'abc')
	dmp.patch_splitMax(patches)
	assertEquals(
		'@@ -1,32 +1,4 @@\n-1234567890123456789012345678\n 9012\n@@ -29,32 +1,4 @@\n-9012345678901234567890123456\n 7890\n@@ -57,14 +1,3 @@\n-78901234567890\n+abc\n',
		dmp.patch_toText(patches),
	)

	patches = dmp.patch_make(
		'abcdefghij , h : 0 , t : 1 abcdefghij , h : 0 , t : 1 abcdefghij , h : 0 , t : 1',
		'abcdefghij , h : 1 , t : 1 abcdefghij , h : 1 , t : 1 abcdefghij , h : 0 , t : 1',
	)
	dmp.patch_splitMax(patches)
	assertEquals(
		'@@ -2,32 +2,32 @@\n bcdefghij , h : \n-0\n+1\n  , t : 1 abcdef\n@@ -29,32 +29,32 @@\n bcdefghij , h : \n-0\n+1\n  , t : 1 abcdef\n',
		dmp.patch_toText(patches),
	)
})

Deno.test(dmp.patch_addPadding.name, () => {
	// Both edges full.
	let patches = dmp.patch_make('', 'test')
	assertEquals('@@ -0,0 +1,4 @@\n+test\n', dmp.patch_toText(patches))
	dmp.patch_addPadding(patches)
	assertEquals('@@ -1,8 +1,12 @@\n %01%02%03%04\n+test\n %01%02%03%04\n', dmp.patch_toText(patches))

	// Both edges partial.
	patches = dmp.patch_make('XY', 'XtestY')
	assertEquals('@@ -1,2 +1,6 @@\n X\n+test\n Y\n', dmp.patch_toText(patches))
	dmp.patch_addPadding(patches)
	assertEquals('@@ -2,8 +2,12 @@\n %02%03%04X\n+test\n Y%01%02%03\n', dmp.patch_toText(patches))

	// Both edges none.
	patches = dmp.patch_make('XXXXYYYY', 'XXXXtestYYYY')
	assertEquals('@@ -1,8 +1,12 @@\n XXXX\n+test\n YYYY\n', dmp.patch_toText(patches))
	dmp.patch_addPadding(patches)
	assertEquals('@@ -5,8 +5,12 @@\n XXXX\n+test\n YYYY\n', dmp.patch_toText(patches))
})

Deno.test(dmp.patch_apply.name, () => {
	dmp.Match_Distance = 1000
	dmp.Match_Threshold = 0.5
	dmp.Patch_DeleteThreshold = 0.5
	// Null case.
	let patches = dmp.patch_make('', '')
	let results = dmp.patch_apply(patches, 'Hello world.')
	assertEquals(['Hello world.', []], results)

	// Exact match.
	patches = dmp.patch_make(
		'The quick brown fox jumps over the lazy dog.',
		'That quick brown fox jumped over a lazy dog.',
	)
	results = dmp.patch_apply(patches, 'The quick brown fox jumps over the lazy dog.')
	assertEquals(['That quick brown fox jumped over a lazy dog.', [true, true]], results)

	// Partial match.
	results = dmp.patch_apply(patches, 'The quick red rabbit jumps over the tired tiger.')
	assertEquals(['That quick red rabbit jumped over a tired tiger.', [true, true]], results)

	// Failed match.
	results = dmp.patch_apply(patches, 'I am the very model of a modern major general.')
	assertEquals(['I am the very model of a modern major general.', [false, false]], results)

	// Big delete, small change.
	patches = dmp.patch_make('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
	results = dmp.patch_apply(
		patches,
		'x123456789012345678901234567890-----++++++++++-----123456789012345678901234567890y',
	)
	assertEquals(['xabcy', [true, true]], results)

	// Big delete, big change 1.
	patches = dmp.patch_make('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
	results = dmp.patch_apply(
		patches,
		'x12345678901234567890---------------++++++++++---------------12345678901234567890y',
	)
	assertEquals(['xabc12345678901234567890---------------++++++++++---------------12345678901234567890y', [
		false,
		true,
	]], results)

	// Big delete, big change 2.
	dmp.Patch_DeleteThreshold = 0.6
	patches = dmp.patch_make('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
	results = dmp.patch_apply(
		patches,
		'x12345678901234567890---------------++++++++++---------------12345678901234567890y',
	)
	assertEquals(['xabcy', [true, true]], results)
	dmp.Patch_DeleteThreshold = 0.5

	// Compensate for failed patch.
	dmp.Match_Threshold = 0.0
	dmp.Match_Distance = 0
	patches = dmp.patch_make(
		'abcdefghijklmnopqrstuvwxyz--------------------1234567890',
		'abcXXXXXXXXXXdefghijklmnopqrstuvwxyz--------------------1234567YYYYYYYYYY890',
	)
	results = dmp.patch_apply(patches, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ--------------------1234567890')
	assertEquals(['ABCDEFGHIJKLMNOPQRSTUVWXYZ--------------------1234567YYYYYYYYYY890', [false, true]], results)
	dmp.Match_Threshold = 0.5
	dmp.Match_Distance = 1000

	// No side effects.
	patches = dmp.patch_make('', 'test')
	let patchstr = dmp.patch_toText(patches)
	dmp.patch_apply(patches, '')
	assertEquals(patchstr, dmp.patch_toText(patches))

	// No side effects with major delete.
	patches = dmp.patch_make('The quick brown fox jumps over the lazy dog.', 'Woof')
	patchstr = dmp.patch_toText(patches)
	dmp.patch_apply(patches, 'The quick brown fox jumps over the lazy dog.')
	assertEquals(patchstr, dmp.patch_toText(patches))

	// Edge exact match.
	patches = dmp.patch_make('', 'test')
	results = dmp.patch_apply(patches, '')
	assertEquals(['test', [true]], results)

	// Near edge exact match.
	patches = dmp.patch_make('XY', 'XtestY')
	results = dmp.patch_apply(patches, 'XY')
	assertEquals(['XtestY', [true]], results)

	// Edge partial match.
	patches = dmp.patch_make('y', 'y123')
	results = dmp.patch_apply(patches, 'x')
	assertEquals(['x123', [true]], results)
})
