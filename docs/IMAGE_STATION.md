# Image Station

28 public workflows at `/stations/image`: all requested tools except PNG/JPG-to-AVIF, which are intentionally not exposed without a verified genuine client encoder. Favicon reuses the existing canonical Web route rather than registering a duplicate. AVIF decode attempts genuine native decoding and fails truthfully when unsupported.

Image directional raster/SVG routes use the shared capability registry and memory-only converter session. Output Format offers only registered targets for the validated source; changing it navigates client-side and retains the original File. A mislabeled raster is resolved from decoded bytes, and same-format targets are never offered.

## Processing and security

Lazy `ImageStation` and modular `lib/tools/image/` use local File/Blob, header sniffing, native bitmap/Image decoding and canvas. Native JPEG/WebP/PNG output MIME and signatures are checked, including canvas PNG fallback detection. No uploads, fetch, analytics/content logs or input persistence. Files capped at16MiB,8192px/side,16M pixels with header bounds before decode. Base64 requires canonical valid raster bytes and actual decoding; SVG is not accepted as a decoded data URI.

SVG uses bounded saxes parsing and a strict reconstructed static shape/text subset. Scripts, events, foreignObject, styles, hrefs, external resource references, DOCTYPE and processing instructions reject. SVG markup is never inserted into the application DOM. Formatter/minifier preserve mixed/text/accessibility content; full SVG/CSS/resource compatibility is not claimed.

Canvas JPEG composites alpha on selected background (compressor/quality defaults white); WebP/PNG retain transparency. Native EXIF orientation is applied; re-encoding removes metadata and flattens animation. Available metadata is actual file data plus supported bounded JPEG EXIF, not invented GPS/camera values. Compressor/quality output supports JPEG/WebP only; no PNG optimizer/fake quality or AVIF encoder. Resizer initializes intrinsic size and links dimensions when locked; cropper supports pointer and keyboard selection. Palette uses bounded sampled alpha-weighted clusters, not semantic color names.

Every edit invalidates results; new output/Clear/unmount revoke object URLs and release decoder/canvas resources. Downloads have verified output types. Metadata is limited to each contract's outputs. Limits are conservative, not a proof against every native decoder vulnerability.

## Executed Image gate

Node22.19; baseline typecheck,4,582 tests/55files and production build passed; no Git repository. ESLint has no noninteractive config, so lint was not claimed or forced through setup.

Image: `npm run typecheck` and focused engine/UI/cropper/registry tests passed **265 tests/9files**. Tests include malformed/bounded inputs, signatures, transparency transforms, Unicode, directional metadata, keyboard/aspect/crop, object URL/stale cleanup, exact fields, copy/download/Clear, light/dark DOM and hydration. Native adapter tests are explicitly mocks, not real-codec evidence.

After all three stations, the repository-wide suite passed **5,205 tests / 72 files**, typecheck passed, and the production build passed. The final build emitted the Image, Spreadsheet and Markdown station routes plus the expanded tool catalog. Lint remains noninteractive/missing-config failure.

Live browser at310×444 verified landing28cards/count/description and SVG-to-PNG controls/title. Screenshot failed; fill was blocked by browser-panel tab selection with no action dispatched. Native conversion/compression/resize/crop/Base64/favicon/palette processing, clipboard/download, actual AVIF decode, real theme/desktop/tablet/mobile visuals, console/CSP/network and live accessibility are **NOT VERIFIED**. Existing shared310px overflow is not fixed or claimed fixed.
