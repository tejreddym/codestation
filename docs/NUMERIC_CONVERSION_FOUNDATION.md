# Numeric conversion foundation

This foundation is intentionally independent of station registries, routes, and React components. The metadata authorities are `config/unit-tools.ts`, `config/temperature-tools.ts`, and `config/number-base-tools.ts`; pure engines and tests are under `lib/tools/unit/`, `lib/tools/temperature/`, and `lib/tools/number-base/`.

## Unit Converter

`unitCatalog` contains length, mass, area, volume, speed, and digital units. Each entry has a stable `id`, display name/symbol, category, and factor to that category's base unit. Decimal digital prefixes use powers of 1,000; binary prefixes use powers of 1,024. `convertUnitValue` converts finite decimal input, and `convertUnit` returns the typed result with a stable display string. Values and results are bounded to `1e100` and never silently become `Infinity`.

## Temperature Converter

`temperatureScales` is exactly Celsius, Fahrenheit, and Kelvin. `convertTemperatureValue` converts through Kelvin and validates the source and destination against inclusive absolute-zero boundaries. `convertTemperature` returns the typed request/result pair.

## Number Base Converter

`parseNumberBase`, `formatNumberBase`, and `convertNumberBase` use `BigInt`, so signed values remain exact beyond `Number.MAX_SAFE_INTEGER`. Bases are integers 2–36 and input is limited to 4,096 characters. Digits are case-insensitive and output is lowercase. Optional prefixes are exact: `0b`/`0o`/`0d`/`0x` are accepted only for bases 2/8/10/16 respectively; prefixes are rejected for all other bases or when mismatched. Outputs are unprefixed by default; `outputPrefix` requests the canonical target prefix where one exists.
