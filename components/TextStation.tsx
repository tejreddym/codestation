"use client";

import { useEffect, useState } from "react";
import {
  countText,
  convertTextCase,
  countCharactersNoSpaces,
  countParagraphs,
  countSentences,
  cleanWhitespace,
  convertCase,
  detectBom,
  detectLineEnding,
  diffText,
  extractLinesByRegex,
  extractText,
  findAndReplace,
  generateText,
  normalizeLineEndings,
  normalizeText,
  removeBom,
  reverseText,
  shuffleLines,
  tabsToSpaces,
  spacesToTabs,
  textDiff,
  prefixSuffixText,
  replaceText,
  transformTextLines,
} from "@/lib/tools/text-station";

type Props = { toolId: string };

const CASE_MODES = ["lower", "upper", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant"] as const;
type CaseMode = (typeof CASE_MODES)[number];

const LINE_OPERATIONS = ["sort", "reverse", "deduplicate", "number", "trim", "remove-empty", "filter", "join"] as const;
type LineOperation = (typeof LINE_OPERATIONS)[number];

const GENERATOR_KINDS = ["random", "lorem", "repeat", "uuid", "slug"] as const;
type GeneratorKind = (typeof GENERATOR_KINDS)[number];

const EXTRACTOR_KINDS = ["emails", "urls", "numbers", "hashtags", "mentions", "quoted", "words", "lines"] as const;
type ExtractorKind = (typeof EXTRACTOR_KINDS)[number];
type DiffMode = "unified" | "side-by-side";
type LineEndingMode = "lf" | "crlf" | "cr";

const examples: Record<string, string> = {
  "text-counter": "Code Station\nPrivate by default.",
  "text-case-converter": "Code Station makes small tasks easier.",
  "text-find-replace": "Code Station\ncode locally\nCode tools stay private.",
  "text-diff": "Code Station\nFast local tools.",
  "text-prefix-suffix": "build\ntest\ndeploy",
  "text-line-sorter": "delta\nalpha\ncharlie\nbravo",
  "text-line-deduplicator": "alpha\nbeta\nalpha\ngamma\nbeta",
  "text-line-numberer": "first line\nsecond line\nthird line",
  "text-line-filter": "keep this\nskip this\nkeep that",
  "text-line-reverser": "one\ntwo\nthree",
  "text-random-generator": "",
  "text-lorem-generator": "",
  "text-repeat-generator": "Code Station",
  "text-extract-emails": "Reach ada@example.com or lin@example.org for help.",
  "text-extract-urls": "Docs: https://example.com/docs and https://code.example.org/tools.",
  "text-extract-numbers": "Build 42 shipped in 2026; issue #17 is closed.",
  "text-extract-hashtags": "Ship #local #private tools with #CodeStation.",
  "text-extract-mentions": "Ask @ada or @lin about the release.",
};

const defaultSecondary = "Code Station\nFast browser-first utilities.";

function sampleFor(toolId: string): string {
  return examples[toolId] ?? "Code Station\nWork with text locally.";
}

function slugFor(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "text-result";
}

function isCaseTool(toolId: string): boolean {
  return /case|uppercase|lowercase/.test(toolId) && toolId !== "text-counter";
}

function isFindReplaceTool(toolId: string): boolean {
  return /find|replace/.test(toolId);
}

function isDiffTool(toolId: string): boolean {
  return /diff|compare/.test(toolId);
}

function isPrefixSuffixTool(toolId: string): boolean {
  return /prefix|suffix/.test(toolId);
}

function isLineTool(toolId: string): boolean {
  return /line|lines/.test(toolId) && !isDiffTool(toolId) && toolId !== "regex-line-extractor";
}

function isGeneratorTool(toolId: string): boolean {
  return /generator|lorem|random/.test(toolId) && !/line-number/.test(toolId);
}

function isExtractorTool(toolId: string): boolean {
  return /extract/.test(toolId);
}

function caseFor(toolId: string): CaseMode {
  if (/upper/.test(toolId)) return "upper";
  if (/lower/.test(toolId)) return "lower";
  return "lower";
}

function lineOperationFor(toolId: string): LineOperation {
  if (/dedup|unique/.test(toolId)) return "deduplicate";
  if (/number/.test(toolId)) return "number";
  if (/reverse/.test(toolId)) return "reverse";
  if (/trim/.test(toolId)) return "trim";
  if (/empty/.test(toolId)) return "remove-empty";
  if (/filter|keep/.test(toolId)) return "filter";
  if (/join|merge/.test(toolId)) return "join";
  return "sort";
}

function generatorFor(toolId: string): GeneratorKind {
  if (/lorem/.test(toolId)) return "lorem";
  if (/repeat/.test(toolId)) return "repeat";
  if (/uuid|identifier/.test(toolId)) return "uuid";
  if (/slug/.test(toolId)) return "slug";
  return "random";
}

function extractorFor(toolId: string): ExtractorKind {
  if (/email/.test(toolId)) return "emails";
  if (/url|link/.test(toolId)) return "urls";
  if (/number|integer|numeric/.test(toolId)) return "numbers";
  if (/hashtag|hash-tag/.test(toolId)) return "hashtags";
  if (/mention/.test(toolId)) return "mentions";
  if (/quote/.test(toolId)) return "quoted";
  if (/word/.test(toolId)) return "words";
  return "lines";
}

function formatCounts(value: ReturnType<typeof countText>, input: string): string {
  return [
    `Characters: ${value.characters}`,
    `Characters (no spaces): ${value.charactersNoSpaces}`,
    `Words: ${value.words}`,
    `Lines: ${value.lines}`,
    `Sentences: ${countSentences(input)}`,
    `Paragraphs: ${countParagraphs(input)}`,
  ].join("\n");
}

export default function TextStation({ toolId }: Props) {
  const [input, setInput] = useState(sampleFor(toolId));
  const [secondaryInput, setSecondaryInput] = useState(defaultSecondary);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [caseMode, setCaseMode] = useState<CaseMode>(caseFor(toolId));
  const [findValue, setFindValue] = useState("Code");
  const [replacement, setReplacement] = useState("Station");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replaceAll, setReplaceAll] = useState(true);
  const [diffMode, setDiffMode] = useState<DiffMode>("unified");
  const [regexLinePattern, setRegexLinePattern] = useState("^keep:");
  const [regexLineFlags, setRegexLineFlags] = useState("i");
  const [normalization, setNormalization] = useState<"NFC" | "NFD" | "NFKC" | "NFKD">("NFC");
  const [lineEnding, setLineEnding] = useState<LineEndingMode>("lf");
  const [tabSize, setTabSize] = useState(4);

  const [prefix, setPrefix] = useState("> ");
  const [suffix, setSuffix] = useState("");
  const [eachLine, setEachLine] = useState(true);
  const [skipEmpty, setSkipEmpty] = useState(false);

  const [lineOperation, setLineOperation] = useState<LineOperation>(lineOperationFor(toolId));
  const [descending, setDescending] = useState(false);
  const [lineQuery, setLineQuery] = useState("");
  const [lineSeparator, setLineSeparator] = useState(", ");
  const [lineNumberStart, setLineNumberStart] = useState(1);

  const [generatorLength, setGeneratorLength] = useState(32);
  const [generatorCount, setGeneratorCount] = useState(1);
  const [generatorSeparator, setGeneratorSeparator] = useState("\n");

  const [extractorKind, setExtractorKind] = useState<ExtractorKind>(extractorFor(toolId));
  const [extractUnique, setExtractUnique] = useState(true);

  const inputId = `text-station-input-${slugFor(toolId)}`;
  const secondaryId = `text-station-secondary-${slugFor(toolId)}`;
  const isCounter = toolId === "text-counter";
  const caseTool = isCaseTool(toolId);
  const findReplaceTool = isFindReplaceTool(toolId);
  const diffTool = isDiffTool(toolId);
  const prefixSuffixTool = isPrefixSuffixTool(toolId);
  const lineTool = isLineTool(toolId);
  const generatorTool = isGeneratorTool(toolId);
  const extractorTool = isExtractorTool(toolId);
  const generatorKind = generatorFor(toolId);

  useEffect(() => {
    setInput(sampleFor(toolId));
    setSecondaryInput(defaultSecondary);
    setOutput("");
    setError("");
    setNotice("");
    setStatus("");
    setCaseMode(caseFor(toolId));
    setLineOperation(lineOperationFor(toolId));
    setExtractorKind(extractorFor(toolId));
  }, [toolId]);

  const run = () => {
    setBusy(true);
    setError("");
    setNotice("");
    setStatus("");

    try {
      let result: string;
      let resultStatus = "";
      if (isCounter) {
        result = formatCounts(countText(input), input);
      } else if (caseTool) {
        result = convertTextCase(input, caseMode);
      } else if (findReplaceTool) {
        const replaced = findAndReplace(input, findValue, replacement, { regex: useRegex, caseSensitive, replaceAll });
        result = replaced.text;
        resultStatus = `${replaced.count} match${replaced.count === 1 ? "" : "es"} ${replaced.count === 1 ? "was" : "were"} replaced.`;
      } else if (diffTool) {
        const diff = textDiff(input, secondaryInput);
        result = diffMode === "unified" ? diff.unified : diff.sideBySide.map((row) => `${row.left ? `${row.left.line}: ${row.left.text}` : "       "}  │  ${row.right ? `${row.right.line}: ${row.right.text}` : ""}`).join("\n");
        resultStatus = `${diff.added} added · ${diff.removed} removed`;
      } else if (prefixSuffixTool) {
        result = prefixSuffixText(input, prefix, suffix, { eachLine, skipEmpty });
      } else if (toolId === "reverse-text") {
        result = reverseText(input);
      } else if (toolId === "whitespace-cleaner") {
        result = cleanWhitespace(input);
      } else if (toolId === "regex-line-extractor") {
        result = extractLinesByRegex(input, regexLinePattern, regexLineFlags).join("\n");
      } else if (toolId === "text-normalizer") {
        result = normalizeText(input, normalization);
      } else if (toolId === "tabs-to-spaces") {
        result = tabsToSpaces(input, tabSize);
      } else if (toolId === "spaces-to-tabs") {
        result = spacesToTabs(input, tabSize);
      } else if (["line-ending-converter", "lf-to-crlf", "crlf-to-lf"].includes(toolId)) {
        const target = toolId === "lf-to-crlf" ? "crlf" : toolId === "crlf-to-lf" ? "lf" : lineEnding;
        result = normalizeLineEndings(input, target);
      } else if (toolId === "bom-detector") {
        result = detectBom(input) ? "UTF-8 BOM detected (U+FEFF)." : "No UTF-8 BOM detected.";
      } else if (toolId === "bom-remover") {
        result = removeBom(input);
      } else if (toolId === "sentence-counter") {
        result = `Sentences: ${countSentences(input)}`;
      } else if (toolId === "paragraph-counter") {
        result = `Paragraphs: ${countParagraphs(input)}`;
      } else if (toolId === "character-counter-no-spaces") {
        result = `Characters (no spaces): ${countCharactersNoSpaces(input)}`;
      } else if (lineTool) {
        result = toolId === "line-shuffler" ? shuffleLines(input) : transformTextLines(input, lineOperation, { descending, query: lineQuery, separator: lineSeparator, startNumber: lineNumberStart });
      } else if (generatorTool) {
        result = generateText(generatorKind, { source: input, length: generatorLength, count: generatorCount, separator: generatorSeparator });
      } else if (extractorTool) {
        result = extractText(input, extractorKind, { unique: extractUnique });
      } else {
        throw new Error("This Text Station tool is not configured yet.");
      }
      setOutput(result);
      setStatus(resultStatus);
    } catch (cause) {
      setOutput("");
      setError(cause instanceof Error ? cause.message : "Could not process this text.");
    } finally {
      setBusy(false);
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(output);
      setNotice("Output copied to the clipboard.");
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Select the output and copy it manually.");
    }
  };

  const downloadOutput = () => {
    if (!output) return;
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    link.href = url;
    link.download = `${slugFor(toolId)}-result.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Output downloaded.");
    setError("");
  };

  const useOutputAsInput = () => {
    if (!output) return;
    setInput(output);
    setOutput("");
    setNotice("Output moved to the input.");
    setError("");
  };

  const clear = () => {
    setInput("");
    setSecondaryInput("");
    setOutput("");
    setError("");
    setNotice("");
    setStatus("");
    setFindValue("");
    setReplacement("");
    setPrefix("");
    setSuffix("");
    setLineQuery("");
    setLineSeparator(", ");
    setLineNumberStart(1);
  };

  const loadExample = () => {
    setInput(sampleFor(toolId));
    if (diffTool) setSecondaryInput(defaultSecondary);
    setOutput("");
    setError("");
    setNotice("Example loaded.");
  };

  const renderControls = () => {
    if (caseTool) {
      return <fieldset><legend>Case conversion</legend><div className="option-grid"><label htmlFor={`${inputId}-case`}>Case<select id={`${inputId}-case`} value={caseMode} onChange={(event) => setCaseMode(event.target.value as CaseMode)}><option value="lower">lowercase</option><option value="upper">UPPERCASE</option><option value="title">Title Case</option><option value="sentence">Sentence case</option><option value="camel">camelCase</option><option value="pascal">PascalCase</option><option value="snake">snake_case</option><option value="kebab">kebab-case</option><option value="constant">CONSTANT_CASE</option></select></label></div></fieldset>;
    }

    if (findReplaceTool) {
      return <fieldset><legend>Find and replace</legend><div className="option-grid"><label htmlFor={`${inputId}-find`}>Find<input id={`${inputId}-find`} value={findValue} onChange={(event) => setFindValue(event.target.value)} placeholder="Text or pattern" /></label><label htmlFor={`${inputId}-replacement`}>Replace with<input id={`${inputId}-replacement`} value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label></div><div className="check-grid"><label><input type="checkbox" checked={useRegex} onChange={(event) => setUseRegex(event.target.checked)} /> Treat find value as a regular expression</label><label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} /> Match case</label><label><input type="checkbox" checked={replaceAll} onChange={(event) => setReplaceAll(event.target.checked)} /> Replace all matches</label></div></fieldset>;
    }

    if (prefixSuffixTool) {
      return <fieldset><legend>Prefix and suffix</legend><div className="option-grid"><label htmlFor={`${inputId}-prefix`}>Prefix<input id={`${inputId}-prefix`} value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="Prefix" /></label><label htmlFor={`${inputId}-suffix`}>Suffix<input id={`${inputId}-suffix`} value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="Suffix" /></label></div><div className="check-grid"><label><input type="checkbox" checked={eachLine} onChange={(event) => setEachLine(event.target.checked)} /> Apply to each line</label><label><input type="checkbox" checked={skipEmpty} onChange={(event) => setSkipEmpty(event.target.checked)} /> Skip empty lines</label></div></fieldset>;
    }

    if (diffTool) {
      return <fieldset><legend>Diff view</legend><label htmlFor={`${inputId}-diff-mode`}>View<select id={`${inputId}-diff-mode`} value={diffMode} onChange={(event) => setDiffMode(event.target.value as DiffMode)}><option value="unified">Unified diff</option><option value="side-by-side">Side-by-side rows</option></select></label><p className="muted">Added lines are shown with + and removed lines with − in unified view.</p></fieldset>;
    }

    if (toolId === "regex-line-extractor") {
      return <fieldset><legend>Line pattern</legend><div className="option-grid"><label htmlFor={`${inputId}-regex-line-pattern`}>Regular expression<input id={`${inputId}-regex-line-pattern`} value={regexLinePattern} onChange={(event) => setRegexLinePattern(event.target.value)} /></label><label htmlFor={`${inputId}-regex-line-flags`}>Flags<input id={`${inputId}-regex-line-flags`} value={regexLineFlags} onChange={(event) => setRegexLineFlags(event.target.value)} placeholder="i" /></label></div></fieldset>;
    }

    if (toolId === "text-normalizer") return <fieldset><legend>Unicode normalization</legend><label htmlFor={`${inputId}-normalization`}>Form<select id={`${inputId}-normalization`} value={normalization} onChange={(event) => setNormalization(event.target.value as typeof normalization)}><option>NFC</option><option>NFD</option><option>NFKC</option><option>NFKD</option></select></label></fieldset>;
    if (toolId === "tabs-to-spaces" || toolId === "spaces-to-tabs") return <fieldset><legend>Indentation</legend><label htmlFor={`${inputId}-tab-size`}>Tab size<input id={`${inputId}-tab-size`} type="number" min="1" max="16" value={tabSize} onChange={(event) => setTabSize(Number(event.target.value))} /></label><p className="muted">{toolId === "tabs-to-spaces" ? "Each tab is expanded to this many spaces." : "Runs of this many spaces become one tab."}</p></fieldset>;
    if (["line-ending-converter", "lf-to-crlf", "crlf-to-lf"].includes(toolId)) return <fieldset><legend>Line endings</legend><label htmlFor={`${inputId}-line-ending`}>Output format<select id={`${inputId}-line-ending`} value={toolId === "lf-to-crlf" ? "crlf" : toolId === "crlf-to-lf" ? "lf" : lineEnding} onChange={(event) => setLineEnding(event.target.value as LineEndingMode)} disabled={toolId !== "line-ending-converter"}><option value="lf">LF (Unix)</option><option value="crlf">CRLF (Windows)</option><option value="cr">CR (classic Mac)</option></select></label><p className="muted">Detected input: {detectLineEnding(input)}.</p></fieldset>;
    if (toolId === "line-shuffler") return <p className="muted">Lines will be shuffled with browser randomness. The input remains local.</p>;
    if (toolId === "reverse-text") return <p className="muted">Reverses by Unicode code point so emoji and other multi-code-unit characters stay intact.</p>;
    if (["whitespace-cleaner", "empty-line-remover", "bom-detector", "bom-remover", "sentence-counter", "paragraph-counter", "character-counter-no-spaces"].includes(toolId)) return <p className="muted">This operation runs locally and keeps your text in the browser.</p>;

    if (lineTool) {
      return <fieldset><legend>Line controls</legend><div className="option-grid"><label htmlFor={`${inputId}-line-operation`}>Operation<select id={`${inputId}-line-operation`} value={lineOperation} onChange={(event) => setLineOperation(event.target.value as LineOperation)}><option value="sort">Sort lines</option><option value="reverse">Reverse lines</option><option value="deduplicate">Remove duplicates</option><option value="number">Number lines</option><option value="trim">Trim lines</option><option value="remove-empty">Remove empty lines</option><option value="filter">Filter lines</option><option value="join">Join lines</option></select></label>{lineOperation === "filter" && <label htmlFor={`${inputId}-line-query`}>Keep lines containing<input id={`${inputId}-line-query`} value={lineQuery} onChange={(event) => setLineQuery(event.target.value)} placeholder="Filter text" /></label>}{lineOperation === "join" && <label htmlFor={`${inputId}-line-separator`}>Join separator<input id={`${inputId}-line-separator`} value={lineSeparator} onChange={(event) => setLineSeparator(event.target.value)} /></label>}{lineOperation === "number" && <label htmlFor={`${inputId}-line-start`}>Start number<input id={`${inputId}-line-start`} type="number" min="0" step="1" value={lineNumberStart} onChange={(event) => setLineNumberStart(Number(event.target.value))} /></label>}</div><div className="check-grid">{lineOperation === "sort" && <label><input type="checkbox" checked={descending} onChange={(event) => setDescending(event.target.checked)} /> Sort descending</label>}</div></fieldset>;
    }

    if (generatorTool) {
      return <fieldset><legend>Generator settings</legend><div className="option-grid">{generatorKind !== "repeat" && generatorKind !== "slug" && <label htmlFor={`${inputId}-length`}>Length<input id={`${inputId}-length`} type="number" min="1" max="10000" value={generatorLength} onChange={(event) => setGeneratorLength(Number(event.target.value))} /></label>}{generatorKind === "lorem" && <label htmlFor={`${inputId}-count`}>Paragraphs or items<input id={`${inputId}-count`} type="number" min="1" max="100" value={generatorCount} onChange={(event) => setGeneratorCount(Number(event.target.value))} /></label>}{generatorKind === "repeat" && <label htmlFor={`${inputId}-count`}>Repetitions<input id={`${inputId}-count`} type="number" min="1" max="1000" value={generatorCount} onChange={(event) => setGeneratorCount(Number(event.target.value))} /></label>}{generatorKind === "repeat" && <label htmlFor={`${inputId}-separator`}>Separator<input id={`${inputId}-separator`} value={generatorSeparator} onChange={(event) => setGeneratorSeparator(event.target.value)} /></label>}</div><p className="muted">{generatorKind === "random" ? "Secure random text is generated locally in your browser." : generatorKind === "repeat" ? "The input text is repeated without leaving this browser." : "Configure the options, then generate a result."}</p></fieldset>;
    }

    if (extractorTool) {
      return <fieldset><legend>Extractor settings</legend><div className="option-grid"><label htmlFor={`${inputId}-extractor`}>Extract<select id={`${inputId}-extractor`} value={extractorKind} onChange={(event) => setExtractorKind(event.target.value as ExtractorKind)}><option value="emails">Email addresses</option><option value="urls">URLs</option><option value="numbers">Numbers</option><option value="hashtags">Hashtags</option><option value="mentions">Mentions</option><option value="quoted">Quoted text</option><option value="words">Words</option><option value="lines">Non-empty lines</option></select></label></div><div className="check-grid"><label><input type="checkbox" checked={extractUnique} onChange={(event) => setExtractUnique(event.target.checked)} /> Return unique matches only</label></div><p className="muted">Extract matching values from the input without sending it anywhere.</p></fieldset>;
    }

    if (isCounter) return <p className="muted">Counts are based on the text currently in the input and are calculated locally.</p>;
    return <p className="muted">Choose an operation, then run it on the text above.</p>;
  };

  return <div className="text-station">
    {renderControls()}
    {diffTool && <div className="panel diff-input"><div className="panel-head"><span>Compare with</span><button className="button" type="button" onClick={() => setSecondaryInput(defaultSecondary)}>Example</button></div><textarea id={secondaryId} value={secondaryInput} onChange={(event) => setSecondaryInput(event.target.value)} aria-label="Comparison text" placeholder="Paste the second text here." /></div>}
    <div className="tool-layout"><div className="panel"><div className="panel-head"><span>Input</span><button className="button" type="button" onClick={loadExample}>Example</button></div><textarea id={inputId} value={input} onChange={(event) => setInput(event.target.value)} aria-label="Text Station input" placeholder="Paste text here to begin." /></div><div className="panel"><div className="panel-head"><span>Output</span><span><button className="button" type="button" onClick={copyOutput} disabled={!output}>Copy</button> <button className="button" type="button" onClick={downloadOutput} disabled={!output}>Download</button></span></div><div className="output" aria-live="polite">{output || "Your result will appear here."}</div></div></div>
    <div className="actions"><button className="button primary" type="button" onClick={run} disabled={busy}>{busy ? "Processing…" : isCounter ? "Count text" : generatorTool ? "Generate" : extractorTool ? "Extract" : "Run tool"}</button><button className="button" type="button" onClick={useOutputAsInput} disabled={!output}>Use output as input</button><button className="button" type="button" onClick={clear}>Clear</button></div>
     {status && <p className="muted" aria-live="polite">{status}</p>}
     {output && <p className="muted" aria-live="polite">{output.length} characters · {output.split(/\r\n|\r|\n/).length} line{output.split(/\r\n|\r|\n/).length === 1 ? "" : "s"}</p>}
    {error && <div className="error" role="alert">{error}</div>}
    {notice && <div className="muted" role="status">{notice}</div>}
    <p className="privacy">↳ Runs locally in your browser. Nothing is sent to Code Station.</p>
  </div>;
}
