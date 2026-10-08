/** Browser-independent public Text contracts. Legacy TextStation consumers are separate. */
export const textToolIds = ["text-counter", "case-converter", "duplicate-line-remover", "sort-lines", "reverse-lines", "reverse-text", "whitespace-cleaner", "empty-line-remover", "prefix-suffix-adder", "find-replace", "text-diff", "slug-generator", "lorem-ipsum-generator", "random-text-generator", "url-extractor", "email-extractor", "number-extractor", "regex-line-extractor", "line-deduplicator", "line-shuffler", "text-normalizer", "tabs-to-spaces", "spaces-to-tabs", "line-ending-converter", "lf-to-crlf", "crlf-to-lf", "bom-detector", "bom-remover", "sentence-counter", "paragraph-counter", "character-counter-without-spaces"] as const;
export type TextToolId = (typeof textToolIds)[number];
export type TextInputField = {
  name: string;
  label: string;
  control: "textarea" | "text" | "number" | "select" | "checkbox" | "checkbox-group";
  options?: readonly string[];
  min?: number;
  max?: number;
  hint?: string;
};
export type TextToolContract = {
  fields: readonly TextInputField[];
  defaults: Readonly<Record<string, string | boolean>>;
  example: Readonly<Record<string, string | boolean>>;
  action: string;
  outputLabel: string;
  outputs: readonly string[];
  notices: readonly string[];
  privacyMessage: string;
  purpose: string;
  usage: string;
};
export type TextToolDefinition = {
  id: TextToolId;
  slug: TextToolId;
  name: string;
  description: string;
  category: "Text";
  keywords: readonly string[];
  featured?: boolean;
  textContract: TextToolContract;
  relatedTools: readonly TextToolId[];
  seo: { title: string; description: string };
  pairId?: string;
  direction?: "forward" | "reverse";
  pairedTool?: TextToolId;
  inputFormat?: string;
  outputFormat?: string;
};

const text: TextInputField = { name: "text", label: "Text", control: "textarea" };
const select = (name: string, label: string, options: readonly string[]): TextInputField => ({ name, label, control: "select", options });
const caseSensitivity = select("caseSensitivity", "Case sensitivity", ["Case-sensitive", "Case-insensitive"]);
const width: TextInputField = { name: "width", label: "Spaces per tab", control: "number", min: 1, max: 16 };
const limits = "Limits: 1,000,000 input UTF-16 code units, 4,000,000 output code units and 100,000 lines. Oversized inputs or results fail explicitly; nothing is silently truncated. Larger work uses a local worker with a 10-second timeout.";
const lines = "Line operations recognize CRLF, LF and CR and normalize mixed endings to the first encountered separator. A terminal newline is a terminator, not an extra record. Empty text has zero records.";
const graphemes = "Characters are grapheme clusters using Intl.Segmenter when available, with a Unicode code-point fallback. Counts excluding spaces remove all whitespace.";
const sentences = "Sentence counts are estimates based on punctuation and text boundaries, not linguistic analysis; abbreviations can affect the result.";
const generated = "Generation limits: 100,000 characters, 10,000 words, 1,000 sentences or 100 paragraphs. Amounts must be positive whole numbers; limits are rejected rather than clamped.";
const extraction = "Matches remain in source order, including duplicates. Output is inert text, never opened or fetched. At most 10,000 matches are returned; exceeding this limit produces an error.";
const bom = "Detects a leading U+FEFF character in decoded text. Text alone cannot identify the original byte encoding or reliably distinguish a UTF-8, UTF-16 or UTF-32 byte-order mark.";
const publicText = "Hello, world!\nWelcome to Code Station.\n\nText tools run locally.";

type Extra = Partial<Pick<TextToolDefinition, "pairId" | "direction" | "pairedTool" | "inputFormat" | "outputFormat" | "relatedTools">> & { defaults?: Record<string, string | boolean> };
function define(id: TextToolId, name: string, description: string, fields: readonly TextInputField[], action: string, outputs: readonly string[], usage: string, example: Record<string, string | boolean>, notices: readonly string[] = [], extra: Extra = {}): TextToolDefinition {
  const { defaults, ...metadata } = extra;
  return {
    id, slug: id, name, description, category: "Text",
    keywords: [...new Set([...name.toLowerCase().split(/[\s/-]+/), "text", "local", "browser"])],
    featured: id === "text-counter" ? true : undefined,
    relatedTools: (["text-counter", "text-normalizer", "find-replace"] as const).filter(slug => slug !== id),
    ...metadata,
    seo: { title: `${name} — Local Text Tool`, description },
    textContract: {
      fields, action, outputs, outputLabel: outputs[0],
      defaults: { ...Object.fromEntries(fields.map(field => [field.name, field.control === "select" ? field.options?.[0] ?? "" : field.control === "checkbox" ? true : ""])), ...defaults },
      example, notices: [...notices, limits],
      privacyMessage: "Processed locally in your browser. Inputs and results are not uploaded or saved by this page.",
      purpose: description,
      usage: `${usage} Choose “${action}”, then copy individual result values if needed. Clear removes the inputs and results and restores all option defaults.`,
    },
  };
}

export const textTools: readonly TextToolDefinition[] = [
  define("text-counter", "Text Counter", "Count characters, characters without whitespace, words, lines, estimated sentences and paragraphs locally.", [text], "Count text", ["Character count", "Character count without spaces", "Word count", "Line count", "Sentence count", "Paragraph count"], "Enter the text to count.", { text: publicText }, [graphemes, sentences, lines]),
  define("case-converter", "Case Converter", "Transform text into uppercase, lowercase, title, sentence, camel, Pascal, snake, kebab or constant case in your browser.", [text, select("caseType", "Case type", ["UPPERCASE", "lowercase", "Title Case", "Sentence case", "camelCase", "PascalCase", "snake_case", "kebab-case", "CONSTANT_CASE"])], "Convert case", ["Transformed text"], "Enter text and choose its case type.", { text: "hello world from Code Station", caseType: "Title Case" }, ["Identifier-style case changes whitespace, underscores and hyphens as separators. Other punctuation and emoji are retained; the result is not guaranteed to be a valid programming identifier."]),
  define("duplicate-line-remover", "Duplicate Line Remover", "Remove repeated lines locally while preserving the first occurrence and your chosen case sensitivity.", [text, caseSensitivity], "Remove duplicate lines", ["Text with duplicate lines removed"], "Enter lines and choose whether case matters.", { text: "apple\nBanana\napple\nbanana", caseSensitivity: "Case-sensitive" }, [lines], { relatedTools: ["line-deduplicator", "sort-lines"] }),
  define("sort-lines", "Sort Lines", "Sort text lines A to Z or Z to A with explicit case-sensitive or case-insensitive comparison.", [text, select("sortOrder", "Sort order", ["A → Z", "Z → A"]), caseSensitivity], "Sort lines", ["Sorted text"], "Enter lines, choose a sort order and choose case sensitivity.", { text: "pear\napple\nBanana", sortOrder: "A → Z", caseSensitivity: "Case-insensitive" }, [lines]),
  define("reverse-lines", "Reverse Lines", "Reverse the order of text lines without reversing their content, entirely in your browser.", [text], "Reverse lines", ["Reversed line order"], "Enter the lines to reverse.", { text: "first\nsecond\nthird\n" }, [lines]),
  define("reverse-text", "Reverse Text", "Reverse text by grapheme cluster where supported, keeping combined characters and emoji together.", [text], "Reverse text", ["Reversed text"], "Enter the text to reverse.", { text: "Hello 👩‍💻 café" }, [graphemes]),
  define("whitespace-cleaner", "Whitespace Cleaner", "Clean unnecessary whitespace in text locally while retaining its line structure.", [text], "Clean whitespace", ["Cleaned text"], "Enter the text whose whitespace needs cleaning.", { text: "  Hello   world  \n  Code\t Station  " }, [lines]),
  define("empty-line-remover", "Empty Line Remover", "Remove empty and whitespace-only lines from text while preserving the remaining line content.", [text], "Remove empty lines", ["Text without empty lines"], "Enter text containing blank lines.", { text: "first\n\n   \nsecond\n" }, [lines]),
  define("prefix-suffix-adder", "Prefix / Suffix Adder", "Apply a literal prefix and suffix to every text line with browser-local processing.", [text, { name: "prefix", label: "Prefix", control: "text" }, { name: "suffix", label: "Suffix", control: "text" }], "Add prefix and suffix", ["Text with prefix and suffix applied to every line"], "Enter lines and the prefix and suffix to apply. Either affix may be empty.", { text: "apple\nbanana", prefix: "[", suffix: "]" }, [lines]),
  define("find-replace", "Find & Replace", "Replace literal text with explicit case sensitivity and a choice of first or all occurrences, without regex syntax.", [text, { name: "find", label: "Find text", control: "text" }, { name: "replacement", label: "Replace text", control: "text" }, caseSensitivity, { name: "replaceAll", label: "Replace all", control: "checkbox" }], "Replace text", ["Updated text", "Replacement count"], "Enter text, a nonempty search string and replacement text. Choose case sensitivity and whether to replace all matches.", { text: "Hello world. Hello again.", find: "Hello", replacement: "Hi", caseSensitivity: "Case-sensitive", replaceAll: true }, ["Search and replacement are literal text. Regex patterns and replacement tokens have no special meaning. An empty replacement removes matches."]),
  define("text-diff", "Text Diff", "Compare two text documents locally and inspect readable added, removed and unchanged line content.", [{ name: "textA", label: "Text A", control: "textarea" }, { name: "textB", label: "Text B", control: "textarea" }], "Compare text", ["Diff result", "Added content", "Removed content", "Unchanged content"], "Enter the original text in Text A and the revised text in Text B.", { textA: "apple\nbanana\ncherry", textB: "apple\nblueberry\ncherry" }, ["Diff is line-based. Cards label added (+), removed (−) and unchanged (=) content. Limits: 2,000 lines per side and 4,000,000 comparison cells. Diff runs in a local worker with a 10-second timeout.", "Line endings are part of each comparison token: CRLF, LF, CR and a missing terminal newline remain distinguishable. A terminal newline is not an extra record. Empty text has zero records."]),
  define("slug-generator", "Slug Generator", "Create a URL-friendly lowercase slug from text with local normalization and hyphen-separated words.", [text], "Generate slug", ["URL slug"], "Enter the title or phrase to turn into a slug.", { text: "Hello World! A New Post" }),
  define("lorem-ipsum-generator", "Lorem Ipsum Generator", "Generate an exact requested number of Lorem Ipsum words, sentences or paragraphs locally.", [{ name: "amount", label: "Amount", control: "number", min: 1 }, select("unit", "Unit", ["Words", "Sentences", "Paragraphs"])], "Generate Lorem Ipsum", ["Generated Lorem Ipsum", "Generated count"], "Enter a positive whole amount and choose words, sentences or paragraphs.", { amount: "50", unit: "Words" }, [generated], { defaults: { amount: "50", unit: "Words" } }),
  define("random-text-generator", "Random Text Generator", "Generate random fixture text by characters, words, sentences or paragraphs using browser randomness.", [{ name: "length", label: "Length", control: "number", min: 1 }, select("unit", "Unit", ["Characters", "Words", "Sentences", "Paragraphs"])], "Generate random text", ["Generated random text", "Generated count"], "Enter a positive whole length and select its unit.", { length: "100", unit: "Characters" }, [generated, "Generated text is intended for fixtures and placeholders, not passwords or security tokens."], { defaults: { length: "100", unit: "Characters" } }),
  define("url-extractor", "URL Extractor", "Extract URL text and count occurrences without navigating to or fetching any extracted address.", [text], "Extract URLs", ["Extracted URLs", "URL count"], "Enter text containing URLs.", { text: "Visit https://example.com and https://example.org/docs." }, [extraction]),
  define("email-extractor", "Email Extractor", "Extract email-address text and count occurrences locally, preserving repeated addresses in source order.", [text], "Extract emails", ["Extracted email addresses", "Email count"], "Enter text containing email addresses.", { text: "Contact hello@example.com or support@example.org." }, [extraction, "Extraction recognizes email-like text; it does not verify mailbox existence or deliverability."]),
  define("number-extractor", "Number Extractor", "Extract signed integer and decimal text and report the number of occurrences without uploading the source.", [text], "Extract numbers", ["Extracted numbers", "Number count"], "Enter text containing numeric values.", { text: "Temperature: -12.5; quantity: 42; adjustment: +0.75" }, [extraction, "Recognizes signed integers and decimal fragments. Scientific notation and locale-specific number formatting are not interpreted as single numeric values."]),
  define("regex-line-extractor", "Regex Line Extractor", "Extract matching lines using a JavaScript regex and explicit flags in a time-limited local worker.", [text, { name: "pattern", label: "Regex pattern", control: "text", hint: "JavaScript pattern source without slash delimiters." }, { name: "flags", label: "Flags", control: "checkbox-group", options: ["g", "i", "m", "s", "u", "y", "d"] }], "Extract matching lines", ["Matching lines", "Match count"], "Enter text and a JavaScript pattern, then select any flags to apply to each line.", { text: "info: ready\nerror: missing file\nwarning: retry\nerror: timed out", pattern: "^error:", flags: "m" }, [lines, "Each line is tested independently with regex state reset. No flags are initially selected. Requires a disposable local worker with a 1,500 ms timeout; unsupported flags and invalid patterns fail clearly.", extraction]),
  define("line-deduplicator", "Line Deduplicator", "Deduplicate text lines while preserving first occurrences and report how many duplicates were removed.", [text, caseSensitivity], "Deduplicate lines", ["Deduplicated text", "Removed duplicate count"], "Enter lines and choose whether comparison is case-sensitive.", { text: "apple\nApple\nbanana\napple", caseSensitivity: "Case-insensitive" }, [lines], { relatedTools: ["duplicate-line-remover", "sort-lines"] }),
  define("line-shuffler", "Line Shuffler", "Shuffle text lines locally using browser randomness while retaining their original content.", [text], "Shuffle lines", ["Shuffled lines"], "Enter the lines to shuffle.", { text: "one\ntwo\nthree\nfour\nfive" }, [lines, "A random shuffle may leave some or all lines in their original positions."]),
  define("text-normalizer", "Text Normalizer", "Normalize Unicode text to NFC and all line endings to LF using one fixed, predictable transformation.", [text], "Normalize text", ["Normalized text"], "Enter text to normalize to NFC and LF.", { text: "Cafe\u0301\r\nHello\rworld" }, ["Always applies Unicode NFC and LF line endings. It does not apply compatibility normalization or offer alternate normalization modes."]),
  define("tabs-to-spaces", "Tabs to Spaces", "Replace tab characters with a chosen number of spaces using an explicit width from 1 to 16.", [text, width], "Convert tabs to spaces", ["Text with tabs replaced by spaces"], "Enter text containing tabs and choose the number of spaces per tab.", { text: "\tfirst\n\t\tsecond", width: "4" }, ["Each tab becomes the chosen number of spaces; this is a fixed-width replacement, not column-aware tab stops."], { defaults: { width: "4" }, pairId: "text-tabs-spaces", direction: "forward", pairedTool: "spaces-to-tabs", inputFormat: "Tabs", outputFormat: "Spaces", relatedTools: ["spaces-to-tabs", "whitespace-cleaner"] }),
  define("spaces-to-tabs", "Spaces to Tabs", "Convert groups of spaces to tabs with an explicit group width from 1 to 16 spaces per tab.", [text, width], "Convert spaces to tabs", ["Text with spaces converted to tabs"], "Enter text containing spaces and choose the group width.", { text: "    first\n        second", width: "4" }, ["Complete groups of the selected number of spaces become tabs. Leftover spaces remain unchanged."], { defaults: { width: "4" }, pairId: "text-tabs-spaces", direction: "reverse", pairedTool: "tabs-to-spaces", inputFormat: "Spaces", outputFormat: "Tabs", relatedTools: ["tabs-to-spaces", "whitespace-cleaner"] }),
  define("line-ending-converter", "Line Ending Converter", "Normalize mixed text line endings to your explicit choice of LF, CRLF or CR.", [text, select("lineEnding", "Line ending", ["LF", "CRLF", "CR"])], "Convert line endings", ["Text with normalized line endings"], "Enter text and choose the target line ending.", { text: "first\r\nsecond\nthird\rfourth", lineEnding: "LF" }, ["All CRLF, LF and CR separators become the selected ending. Copy preserves the exact resulting line-ending characters."], { relatedTools: ["lf-to-crlf", "crlf-to-lf"] }),
  define("lf-to-crlf", "LF to CRLF", "Convert text line endings to Windows-style CRLF with a dedicated fixed-direction tool.", [text], "Convert to CRLF", ["Text with CRLF line endings"], "Enter text to convert its line endings to CRLF.", { text: "first\nsecond\n" }, ["Normalizes CRLF, LF and CR to CRLF without doubling existing carriage returns. Copy retains exact CRLF characters."], { pairId: "text-lf-crlf", direction: "forward", pairedTool: "crlf-to-lf", inputFormat: "LF", outputFormat: "CRLF", relatedTools: ["crlf-to-lf", "line-ending-converter"] }),
  define("crlf-to-lf", "CRLF to LF", "Convert text line endings to Unix-style LF with a dedicated fixed-direction tool.", [text], "Convert to LF", ["Text with LF line endings"], "Enter text to convert its line endings to LF.", { text: "first\r\nsecond\r\n" }, ["Normalizes CRLF, LF and CR to LF. Copy retains the exact resulting characters."], { pairId: "text-lf-crlf", direction: "reverse", pairedTool: "lf-to-crlf", inputFormat: "CRLF", outputFormat: "LF", relatedTools: ["lf-to-crlf", "line-ending-converter"] }),
  define("bom-detector", "BOM Detector", "Detect a leading Unicode U+FEFF byte-order-mark character in decoded text without guessing its original encoding.", [text], "Detect BOM", ["BOM detected status", "BOM type"], "Enter decoded text to inspect its leading character.", { text: "\uFEFFHello, world!" }, [bom], { relatedTools: ["bom-remover", "text-normalizer"] }),
  define("bom-remover", "BOM Remover", "Remove a leading U+FEFF byte-order-mark character from decoded text while retaining other content.", [text], "Remove BOM", ["Text without leading BOM"], "Enter decoded text that may start with U+FEFF.", { text: "\uFEFFHello, world!" }, [bom], { relatedTools: ["bom-detector", "text-normalizer"] }),
  define("sentence-counter", "Sentence Counter", "Estimate the number of sentences in text locally using punctuation and text boundaries.", [text], "Count sentences", ["Sentence count"], "Enter text whose sentences you want to estimate.", { text: "Hello, world! How are you? I am well." }, [sentences]),
  define("paragraph-counter", "Paragraph Counter", "Count nonempty paragraphs separated by blank lines in browser-local text.", [text], "Count paragraphs", ["Paragraph count"], "Enter text with paragraphs separated by blank lines.", { text: "First paragraph.\nStill the first.\n\nSecond paragraph." }, ["Blank or whitespace-only separator lines divide paragraphs. Empty or whitespace-only text has zero paragraphs."]),
  define("character-counter-without-spaces", "Character Counter Without Spaces", "Count text characters after excluding all spaces and whitespace, using grapheme clusters where supported.", [text], "Count characters", ["Character count excluding spaces and whitespace"], "Enter text to count its non-whitespace characters.", { text: "Hello world!\nCode Station 👩‍💻" }, [graphemes]),
];

export function isTextToolId(id: string): id is TextToolId { return textTools.some(tool => tool.id === id); }
export function getTextDefinition(idOrSlug: string): TextToolDefinition | undefined { return textTools.find(tool => tool.id === idOrSlug || tool.slug === idOrSlug); }
