# Diff-Match-Patch Unicode

Modern JS and Unicode-friendly version of [diff-match-patch](https://github.com/google/diff-match-patch).

## Usage

```ts
diff(str1: string, str2: string, options?: { segmenter?: Intl.Segmenter | ((str: string) => string[]) }): Diff[]
```

Diff two strings. Unicode-aware by default, including non-BMP characters.

Pass a `segmenter` option to customize the units of calculation for the diff (char, line, etc).

### Example

```ts
import { DiffMatchPatch, segmenters } from 'diff-match-patch-unicode'

const dmp = new DiffMatchPatch()

const str1 = 'Hello, world! 💫'
const str2 = 'Goodbye, world! 💩'

// default behavior: char diff
dmp.diff(str1, str2) // [-1, "Hell"], [1, "Go"], [0, "o"], [1, "dbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]

// word diff with `Intl.Segmenter`
const segmenter = new Intl.Segmenter('en-US', { granularity: 'word' })
dmp.diff(str1, str2, { segmenter }) // [-1, "Hello"], [1, "Goodbye"], [0, ", world! "], [-1, "💫"], [1, "💩"]

// line diff
dmp.diff(str1, str2, { segmenter: segmenters.line }) // [-1, "Hello, world! 💫"], [1, "Goodbye, world! 💩"]

// UTF-16 code-unit diff (equivalent to using `diff_main` directly)
dmp.diff(str1, str2, { segmenter: segmenters.codeUnit }) // [-1, "Hell"], [1, "Go"], [0, "o"], [1, "dbye"], [0, ", world! \ud83d"], [-1, "\udcab"], [1, "\udca9"]
```

## Limitations

The maximum number of unique segments is capped at 65535 (0xFFFF), the maximum codepoint in the BMP. In addition, the maximum number of unique segments in the first string is capped at two thirds of that total (43690 or 0xAAAA). This is due to the original algorithm working with JS native UTF-16 strings and using non-unicode-aware methods (`String.fromCharCode`, `charAt`, `substring`, etc.) extensively.

If working with diffs larger than this limit, the last segment of each string will contain all of its remaining text until the end of the input.