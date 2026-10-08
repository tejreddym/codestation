import type { ToolDefinition } from "@/config/tools";
const help: Record<string, [string, string, string]> = {
  "json-formatter": ['{"name":"Ada","active":true}', 'Use double quotes around keys and strings. Remove trailing commas.', 'Formatting changes whitespace; it does not repair invalid JSON.'],
  "json-validator": ['{"items":[1,2,3]}', 'Check the character near the reported position, and the comma or quote before it.', 'A syntax check does not establish that data matches your application schema.'],
  "url-parser": ['https://example.com/path?q=hello#section', 'Include a scheme such as https://. Percent-encode spaces and reserved characters in values.', 'Parsing inspects the URL; it does not visit the destination.'],
  "jwt-decoder": ['', 'A JWT has three dot-separated parts. Paste the token without a Bearer prefix.', 'Decoded claims are untrusted. Decoding does not verify a signature.'],
  "color-converter": ['#D9F975', 'Use a supported color notation and keep each channel within its documented range.', 'Alpha can change how a color looks against a background.'],
  "text-counter": ['Hello, Code Station.', 'Paste plain text into the text field. Different character measurements serve different purposes.', 'Bytes, code points and visible characters are not interchangeable.']
};
export default function ToolHelp({ tool }: { tool: ToolDefinition }) {
  const entry = help[tool.slug]; if (!entry) return null;
  return <aside className="workbench-panel tool-help"><h2>A useful starting point</h2>{entry[0] && <><p>Example input</p><pre>{entry[0]}</pre></>}<h3>If the input is rejected</h3><p>{entry[1]}</p><p className="muted">{entry[2]}</p></aside>;
}
