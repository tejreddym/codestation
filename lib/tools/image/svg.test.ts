import { describe, expect, it } from "vitest";
import { svgRasterSource, svgText } from "./svg";

const wrap = (body: string, attributes = "") => `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;
describe("strict non-network SVG source processing", () => {
  it("preserves Unicode, text boundaries, accessibility and mixed nested text", () => {
    const source = wrap('<title id="label">  雪 &amp; 🌈  </title><text xml:space="preserve"> A <tspan> B </tspan> C\n</text>', 'aria-labelledby="label"');
    for (const pretty of [false, true]) {
      const result = svgText(source, pretty); expect(result).toContain('aria-labelledby="label"'); expect(result).toContain('>  雪 &amp; 🌈  </title>'); expect(result).toContain('> A <tspan> B </tspan> C\n</text>');
    }
  });
  it("minifies only safe whitespace outside text contexts and formats shapes", () => {
    const source = wrap('\n  <g>\n <rect width="2"/>\n </g>\n');
    expect(svgText(source, false)).not.toContain("\n"); expect(svgText(source, true)).toContain('\n  <g>\n    <rect');
    expect(svgText(wrap('<text>   <tspan> x </tspan> </text>'), false)).toContain('<text>   <tspan> x </tspan> </text>');
  });
  it.each([
    '<script>alert(1)</script>', '<foreignObject/>', '<image href="https://evil.test/a"/>', '<use href="#x"/>', '<style>rect{fill:red}</style>', '<a/>', '<animate/>',
    '<rect onclick="alert(1)"/>', '<rect ONCLICK="x"/>', '<rect style="fill:url(https://evil.test)"/>', '<rect fill="url(https://evil.test/a)"/>', '<rect fill="url(#local)"/>', '<rect fill="u\\72l(https\\3a //evil.test)"/>', '<rect href="data:image/svg+xml,x"/>', '<rect xmlns="https://evil.test"/>', '<x:rect xmlns:x="http://www.w3.org/2000/svg"/>',
  ])("rejects unsafe elements/attributes: %s", body => expect(() => svgRasterSource(wrap(body))).toThrow());
  it.each(['<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>', '<?xml-stylesheet href="https://evil.test/a"?>'])("rejects XML resource expansion: %s", prefix => expect(() => svgText(prefix + wrap(""), false)).toThrow());
  it.each(["", "<svg>", wrap("</g>"), wrap("&unknown;"), "<html/>", wrap("") + wrap("")])("rejects malformed/non-SVG source %s", source => expect(() => svgText(source, false)).toThrow());
  it("re-escapes CDATA and attribute entities without introducing markup", () => {
    const result = svgText(wrap('<text><![CDATA[<script>雪</script>]]></text>', 'aria-label="&quot; &amp;"'), false);
    expect(result).toContain('&lt;script&gt;雪&lt;/script&gt;'); expect(result).toContain('aria-label="&quot; &amp;"');
  });
  it("preserves harmless descriptive URLs and backslashes as inert accessibility text", () => {
    expect(svgText(wrap('<text>雪</text>', 'aria-label="https://example.test/a\\b"'), false)).toContain('aria-label="https://example.test/a\\b"');
  });
  it("uses intrinsic/default/viewBox/explicit bounds", () => {
    expect(svgRasterSource(wrap(""))).toMatchObject({ width: 300, height: 150 });
    expect(svgRasterSource(wrap("", 'viewBox="0 0 20 10"'))).toMatchObject({ width: 20, height: 10 });
    expect(svgRasterSource(wrap("", 'width="24px" height="16"'), 48, 32)).toMatchObject({ width: 48, height: 32 });
  });
  it.each(['width="0"', 'width="8193"', 'width="4001" height="4000"', 'width="100%"', 'viewBox="0 0 0 1"', 'viewBox="0 0 Infinity 1"'])("rejects invalid intrinsic bounds %s", attrs => expect(() => svgRasterSource(wrap("", attrs))).toThrow());
  it("bounds source, nodes and nesting", () => {
    expect(() => svgText("x".repeat(1_000_001), false)).toThrow(/million/);
    expect(() => svgText(wrap('<rect/>'.repeat(10_001)), false)).toThrow(/10,000/);
    expect(() => svgText(wrap('<g>'.repeat(64) + '</g>'.repeat(64)), false)).toThrow(/64/);
  });
});
