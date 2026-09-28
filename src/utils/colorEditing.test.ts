import { describe, expect, it } from "vitest";
import Color from "colorjs.io";
import {
  colorChannels,
  formatChannels,
  significant,
  channelDigits,
  sliderPosition,
  sliderChannel,
} from "./colorEditing";

describe("precision used by the color editor", () => {
  it("shows zero HSL saturation for #363636, including conversion round trips", () => {
    const gray = new Color("#363636");
    const values = [
      "#363636",
      "hsla(324, 3.9238e-14%, 21.176%, 1)",
      "hsla(340, 3.9238e-14%, 21.221%, 1)",
      ...(["rgb", "hsl", "oklch"] as const).map((model) =>
        formatChannels(colorChannels("#363636", model), model),
      ),
      gray.to("oklch").toString({ precision: 17 }),
    ];
    for (const value of values) {
      const channels = colorChannels(value, "hsl");
      expect(channels.slice(0, 2), value).toEqual([0, 0]);
      expect(formatChannels(channels, "hsl"), value).toMatch(/^hsla\(0, 0%, /);
    }
    expect(formatChannels(colorChannels("#363636", "hsl"), "hsl"))
      .toBe("hsla(0, 0%, 21.176%, 1)");
    expect(formatChannels(colorChannels("hsla(340, 3.9238e-14%, 21.221%, 1)", "hsl"), "hsl"))
      .toBe("hsla(0, 0%, 21.221%, 1)");
  });

  it("normalizes neutral HSL residue while preserving lightness and alpha", () => {
    for (const value of ["oklch(0.666667 0 0 / 0.123456789)", "oklch(0.999999999999 0 0)"]) {
      const original = new Color(value).to("hsl");
      expect(colorChannels(value, "hsl")).toEqual([0, 0, original.coords[2], original.alpha]);
    }
    expect(formatChannels(colorChannels("oklch(0.666667 0 0 / 1)", "hsl"), "hsl")).toBe(
      "hsla(0, 0%, 58.053%, 1)",
    );
  });

  it("retains saturation for every adjacent-code 10-bit near-neutral", () => {
    for (let code = 0; code <= 1023; code++) {
      for (const delta of [-1, 1]) {
        if (code + delta < 0 || code + delta > 1023) continue;
        for (let axis = 0; axis < 3; axis++) {
          const rgb = [code, code, code].map((v) => v / 1023);
          rgb[axis] = (code + delta) / 1023;
          const value = `color(srgb ${rgb.join(" ")})`;
          expect(colorChannels(value, "hsl")[1]).toBeGreaterThan(0);
        }
      }
    }
  });

  it("rounds significant digits across magnitudes, not decimal places", () => {
    expect(significant(350.217391, 5)).toBe(350.22);
    expect(significant(0.000123456789, 5)).toBe(0.00012346);
    expect(significant(0.2073961184, 6)).toBe(0.207396);
    expect(significant(0.501960784, 4)).toBe(0.502);
    expect(significant(0, 6)).toBe(0);
  });

  it("formats the reported red with the model and alpha precision policies", () => {
    expect(formatChannels(colorChannels("#c8102e", "hsl"), "hsl")).toBe(
      "hsla(350.22, 85.185%, 42.353%, 1)",
    );
    expect(formatChannels([0.001234567, 25.123456, 200.98765, 0.1234567], "rgb")).toBe(
      "rgba(0.001235, 25.12, 201, 0.1235)",
    );
  });

  it("does not quantize RGB conversion to integers or alpha to hundredths", () => {
    const channels = colorChannels(
      "rgba(0.249266862, 127.6246334, 254.7507331, 0.5004887586)",
      "rgb",
    );
    expect(channels[0]).toBeCloseTo(0.249266862, 9);
    expect(new Color(formatChannels(channels, "rgb")).alpha).toBe(0.5005);
  });

  it.each(["rgb", "hsl", "oklch"] as const)(
    "preserves sampled 10-bit codes through the actual %s UI serializer",
    (model) => {
      const levels = [0, 1, 2, 15, 31, 127, 255, 511, 512, 767, 1021, 1022, 1023];
      for (const r of levels)
        for (const g of levels)
          for (const b of levels) {
            const codes = [r, g, b];
            const source = new Color("srgb", [r / 1023, g / 1023, b / 1023]);
            const serialized = formatChannels(
              colorChannels(source.toString({ format: "color", precision: 17 }), model),
              model,
            );
            const restored = new Color(serialized).to("srgb").coords;
            expect(restored.map((v) => Math.round((v ?? 0) * 1023) + 0)).toEqual(codes);
          }
    },
  );

  it("preserves every 10-bit channel through slider positioning and RGB/alpha formatting", () => {
    for (let code = 0; code <= 1023; code++) {
      for (const max of [1, 255]) {
        const channel = (code / 1023) * max;
        const result = sliderChannel(
          sliderPosition(channel, max),
          max,
          channelDigits("rgb", max === 1 ? 3 : 0),
        );
        expect(Math.round((result / max) * 1023)).toBe(code);
      }
    }
  });
});
