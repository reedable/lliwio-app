# 10-bit color precision exploration

The tests in `src/utils/colorPrecision.test.ts` explore significant-digit rounding
using the installed Color.js implementation. The editor now applies these
sampled limits through `src/utils/colorEditing.ts`: 4 significant digits for
RGB and alpha, 5 for HSL, and 6 for OKLCH.

Run the exploration and print its tables:

```sh
npm test -- src/utils/colorPrecision.test.ts --silent=false --disableConsoleIntercept --reporter=verbose
```

## Method

Each conversion path uses 26,225 unique 10-bit RGB colors: a boundary-heavy
17-by-17-by-17 grid, every neutral level, near-neutrals, primary and gamut-edge
ramps, and 8,192 seeded pseudorandom samples (before deduplication).

Convert encoded RGB to HSL or OKLCH, round each coordinate to 2 through 7
significant digits using `Number.toPrecision`, then convert back. HSL uses degrees
and percentages; OKLCH uses its Color.js native coordinates, with hue in degrees.
No hex serialization, clipping, or gamut mapping is applied. HSL is tested with
sRGB; OKLCH is tested with both sRGB and Display P3.

A precision passes when every reconstructed channel rounds to its original code
and the maximum absolute error is below half a 10-bit code step. An unrounded
conversion provides the baseline. A separate test exhausts all 1,024 normalized
channel values, also applicable to standalone alpha.

## Measured results

| Conversion | Sampled minimum significant digits | Maximum error at that precision, in code steps | Failed colors at one fewer digit |
| --- | ---: | ---: | ---: |
| sRGB → HSL → sRGB | 5 | 0.085000 | 2,065 |
| sRGB → OKLCH → sRGB | 6 | 0.142183 | 1,030 |
| Display P3 → OKLCH → Display P3 | 6 | 0.119009 | 888 |

Normalized RGB requires 4 significant digits to recover all 1,024 original codes;
3 fails. The unrounded conversion baselines stay below 7e-11 code steps.

Examples of why the preceding precision fails:

- HSL at 4 digits: sRGB `(15, 31, 1021)` has a maximum channel error of 0.878644 code steps.
- OKLCH at 5 digits: sRGB `(0, 1023, 72)` has an error of 1.397893 code steps.
- OKLCH at 5 digits: Display P3 `(0, 1022, 0)` has an error of 1.211892 code steps.

These are sampled minima, not guarantees over all 1,073,741,824 RGB combinations.
The tests lock in the observed minima and verify that higher tested precisions
also pass. Tables include failure counts and worst-case inputs for every tested
precision, making changes in Color.js behavior visible.

This measures one conversion round trip from a 10-bit code grid. It does not
establish guarantees for arbitrary values near quantization boundaries, repeated
edits, alpha compositing, HDR transfer functions, cross-gamut mapping, or browser
color management. The separate `colorEditing.test.ts` suite checks the actual UI serializer against
a boundary-heavy 10-bit RGB grid and checks every 10-bit channel through the
RGB/alpha slider position mapping. Sliders use a million-position grid; numeric
entry bypasses that grid and rounds by significant digits. Opening or focusing
a field does not commit a color change. These checks do not constitute a browser
interaction test.

## Hex display for colors outside sRGB

The Hex field in `src/pages/ColorPage.tsx` uses
`new Color(value).to("srgb").toString({ format: "hex" })`.
For an OKLCH color outside sRGB, hex serialization applies Color.js's default
`css` gamut-mapping method. It reduces OKLCH chroma using perceptual clipping
criteria, then rounds the mapped sRGB channels to 8-bit integers for hex output.
The result is an sRGB approximation, not an exact equivalent of the original
out-of-gamut color.

For example, the installed Color.js version produces:

```text
oklch(0.7 0.4 30) → #ff5843
```

Alpha, when included in hex, is also quantized to an 8-bit channel. Color.js may
use shorthand hex when the channel bytes permit it. This 8-bit serialization is
separate from the significant-digit policy and the 10-bit exploration above;
hex cannot retain their full precision or colors outside sRGB.

Displaying the hex approximation does not replace the stored OKLCH value.
Editing the Hex field and saving with the checkmark replaces the stored color
with the entered sRGB hex value. The gamut-mapped example depends on the
installed Color.js algorithm and defaults and may change with library updates.

## Neutral normalization cutoff exploration

`neutralPrecision.test.ts` tests normalization separately from significant digits.
Run its tables with:

```sh
npm test -- src/utils/neutralPrecision.test.ts --disableConsoleIntercept --reporter=verbose
```

The corpus contains 4,127 known neutrals: all 1,024 gray levels in sRGB,
those grays converted through OKLCH, Display P3 grays, uniformly spaced
zero-chroma OKLCH colors, logarithmic samples near black and white, and the
reported `oklch(0.666667 0 0 / 1)` example.

An HSL-saturation-only threshold is unreliable near white. The previously
suggested `1e-10` percentage-point threshold misses 13 known neutrals. One white
round trip even produces a saturation magnitude of 300%, while its normalized
RGB channel spread is only about `1.22e-15`. This is numerical instability in HSL
near the endpoint, not meaningful chroma.

Instead, measure `max(R,G,B) - min(R,G,B)` in **unclipped, encoded sRGB on the 0–1
scale**. The maximum measured neutral spread is `1.5543122344752192e-15`.
Among the tested thresholds, `1e-14` is the smallest that catches every neutral;
`1e-15` misses 89. A proposed engineering cutoff of **`1e-12` RGB spread** adds
roughly 640 times that observed maximum as numerical margin. This margin is a
judgment, not a measured minimum or a universal guarantee.

Additional checks:

- All 6,138 adjacent-code near-neutrals (one channel one 10-bit code above or
  below gray) remain non-neutral at `1e-12`.
- A deliberately excessive `0.001` spread cutoff erases all 6,138 and changes
  their quantized output, demonstrating the test's sensitivity.
- Setting HSL hue and saturation to zero for the known neutrals preserves every
  sampled 10-bit output code and alpha. Maximum RGB change: `7.95e-13` code steps.
- Of 360 deliberately chromatic OKLCH probes (chroma `1e-4` through `1e-15`),
  106 fall below the proposed cutoff. They are not all numerical noise: this
  intentionally sacrifices extremely small chroma. Maximum measured change in
  these probes is `4.38e-10` of a 10-bit code step; 254 probes remain untouched.

The editor now uses the `1e-12` RGB-spread cutoff to detect neutrality and normalize
**HSL hue and saturation together**, retaining lightness and alpha. It is not a
generic rule for zeroing small RGB channels, OKLCH lightness/chroma, or alpha.
Production normalization is in `colorChannels` in `src/utils/colorEditing.ts`,
with regression tests for the reported example, near-white instability, and all
6,138 adjacent-code near-neutrals. The tests do not exhaust all
colors or guarantee identical quantization for arbitrary values exactly on a
rounding boundary, HDR pipelines, or repeated conversions.
