# Color & CSS Station

Seven local tools at `/stations/color-css`: Color Converter, Color Picker, Palette Generator, Contrast Checker, CSS Gradient Generator, Box Shadow Generator and Border Radius Generator.

## Shared color semantics

`lib/tools/color/engine.ts` is the shared sRGB parser/serializer. It accepts `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, comma/space RGB(A), percentage RGB channels, and comma/space HSL(A) with unitless or `deg` hue. Alpha accepts 0–1 or percentages. Hue wraps cyclically; channels and saturation/lightness are range-checked. Calculations retain decimals and round only display/serialization values. Displayed HEX alpha is the final two digits.

Display-P3, Lab/LCH, OKLab/OKLCH, CMYK, arbitrary CSS `color()` expressions and unverified browser color features are unsupported. Color conversion uses the shared smart-converter registry/session; source stays in memory when the target representation changes and same-format targets are excluded.

Palette relationships are HSL-based: analogous uses 30° steps, complementary uses 180°, split-complementary uses 150°/210°, triadic uses 120° steps, and monochromatic varies lightness. This is not perceptually uniform or an accessibility guarantee.

Contrast uses WCAG 2.x relative luminance and the W3C references [SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [WCAG 2.2 relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance). Black on white is 21:1; thresholds are 4.5/7 for normal text and 3/4.5 for large text. Ratios are compared before display rounding. Transparent foreground/background colors are composited against the explicit opaque backdrop and effective colors are shown. Results are scoped to text contrast, not overall WCAG compliance.

Gradient stops, shadow layers and radius values are structured validated controls serialized to CSS. Equal gradient positions create hard stops. Shadow blur cannot be negative, while offsets/spread may be. Radius corner order is top-left, top-right, bottom-right, bottom-left; elliptical mode uses slash syntax. JSON palette export and copy actions use current edited values.

No user color/CSS data is stored, uploaded, logged or sent to analytics. Generated CSS is text; previews do not inject arbitrary user CSS into the application.

## Verification

Automated Color gate includes shared parser/conversion/contrast/generator tests and registry/page tests. Live browser checks, clipboard, JSON download inspection, applied CSS/computed-style comparison, responsive/theme and console/network checks are **NOT VERIFIED** until a browser tab is available.
