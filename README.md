# Diff-Match-Patch Unicode

Modern JS/TS and Unicode-friendly version of [diff-match-patch](https://github.com/google/diff-match-patch).

## Usage

```ts
diff(str1: string, str2: string, options?: { segmenter?: Intl.Segmenter | ((str: string) => string[]) }): Diff[]
```

Diff two strings. Unicode-aware by default, including non-BMP characters.

Pass a `segmenter` option to customize the units of calculation for the diff (char, line, etc).

### Example

```ts
import { Differ, segmenters } from '@clearlylocal/diff-match-patch-unicode'

const differ = new Differ()

const str1 = 'Hello, world! 💫'
const str2 = 'Goodbye, world! 💩'

// default behavior: UTF-8 char diff
assertDiffsEqual(
	differ.diff(str1, str2),
	[[-1, 'Hell'], [1, 'G'], [0, 'o'], [1, 'odbye'], [0, ', world! '], [-1, '💫'], [1, '💩']],
)

// word diff with `Intl.Segmenter`
assertDiffsEqual(
	differ.diff(str1, str2, { segmenter: segmenters.word }),
	[[-1, 'Hello'], [1, 'Goodbye'], [0, ', world! '], [-1, '💫'], [1, '💩']],
)

// pass in a custom `Intl.Segmenter` instance
assertDiffsEqual(
	differ.diff('两只小蜜蜂', '两只老虎', { segmenter: new Intl.Segmenter('zh-CN', { granularity: 'word' }) }),
	[[0, '两只'], [-1, '小蜜蜂'], [1, '老虎']],
)

// line diff
assertDiffsEqual(
	differ.diff(str1, str2, { segmenter: segmenters.line }),
	[[-1, 'Hello, world! 💫'], [1, 'Goodbye, world! 💩']],
)

// custom UTF-16 code-unit diff (equivalent to using `diff_main` directly... but less performant)
assertDiffsEqual(
	differ.diff(str1, str2, { segmenter: (str) => str.split('') }),
	[[-1, 'Hell'], [1, 'G'], [0, 'o'], [1, 'odbye'], [0, ', world! \ud83d'], [-1, '\udcab'], [1, '\udca9']],
)
```

## Limitations

The maximum number of _unique_ segments (chars, lines, words, graphemes, sentences, code units, etc) is capped at 65535 (0xFFFF), the maximum codepoint in the BMP. In addition, the maximum number of unique segments in the first string is capped at two thirds of that total (43690 or 0xAAAA). This is due to the original algorithm working with JS native UTF-16 strings and using non-UTF-8-aware methods (`String.fromCharCode`, `charAt`, `substring`, `indexOf` etc.) extensively.

If working with diffs larger than this limit, the last segment of each string will contain all of its remaining text until the end of the input.
