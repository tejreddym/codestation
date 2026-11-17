import { localDefinition } from "./local-contract";

export const audioToolIds = [
  "audio-trimmer",
  "audio-compressor",
  "audio-merger",
  "audio-converter",
] as const;
export type AudioToolId = (typeof audioToolIds)[number];

const notice =
  "Zero-server audio processing. Audio waveform decoding, playback, and WAV rendering execute 100% locally in your browser with Web Audio API.";

const define = (
  id: AudioToolId,
  title: string,
  fields: Parameters<typeof localDefinition>[3],
  outputs: readonly string[],
  defaults: Record<string, unknown> = {},
  extra: readonly string[] = [],
) => localDefinition(id, title, "Audio", fields, outputs, defaults, [notice, ...extra], "Process");

const ACCEPT = "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac";

const trimmer = define(
  "audio-trimmer",
  "Audio Trimmer & Cutter",
  [{ name: "file", label: "Audio file", control: "file", accept: ACCEPT }],
  ["Waveform visualization", "Audio playback preview", "Trimmed WAV Download"],
  {},
  ["Trim, cut, and slice audio files in your browser, then export the selected range as 16-bit PCM WAV. Zero uploads, zero latency."],
);

const compressor = define(
  "audio-compressor",
  "Audio Compressor",
  [
    { name: "file", label: "Audio file", control: "file", accept: ACCEPT },
    { name: "threshold", label: "Threshold (dB)", control: "number", min: -60, max: 0 },
    { name: "ratio", label: "Ratio", control: "number", min: 1, max: 20 },
    { name: "attack", label: "Attack (s)", control: "number", min: 0, max: 1 },
    { name: "release", label: "Release (s)", control: "number", min: 0, max: 1 },
    { name: "knee", label: "Knee (dB)", control: "number", min: 0, max: 40 },
    { name: "makeupGain", label: "Makeup gain (dB)", control: "number", min: 0, max: 24 },
    { name: "normalizePeak", label: "Peak-normalise output", control: "checkbox", optional: true },
  ],
  [
    "Offline DynamicsCompressorNode render",
    "Input/output peak dBFS",
    "RMS before and after compression",
    "Measured gain reduction",
    "Compressed WAV download",
  ],
  {
    threshold: -24,
    ratio: 4,
    attack: 0.01,
    release: 0.25,
    knee: 30,
    makeupGain: 0,
    normalizePeak: false,
  },
  [
    "Offline Web Audio rendering processes a decoded copy with DynamicsCompressorNode. Peak, RMS, makeup and normalisation measurements come from the rendered samples, not from a server.",
    "Gain reduction is the measured RMS difference before makeup gain. A signal below the threshold can legitimately show 0 dB reduction.",
    "WAV output is 16-bit PCM. Estimated output above 100 MB triggers a visible warning before processing.",
  ],
);

const merger = define(
  "audio-merger",
  "Audio Merger",
  [
    { name: "files", label: "Audio files (2 or more)", control: "file", accept: ACCEPT },
    { name: "gap", label: "Silence gap (s)", control: "number", min: 0, max: 5, optional: true },
  ],
  [
    "Sequential multi-file merge",
    "Per-file and total duration",
    "Highest-sample-rate two-channel WAV",
    "Measured WAV download",
  ],
  { gap: 0 },
  [
    "Files are joined in the listed order. Every input is normalised to the highest source sample rate and two channels; mono sources are duplicated to both channels.",
    "Optional silence of 0–5 seconds is inserted between consecutive files. The merged result is capped at 30 minutes, and the reason is shown when the plan exceeds that limit.",
    "Merge order can be changed with Move up/Move down, which keep keyboard focus on the moved file. Removing or clearing revokes no external URLs because no object URLs are created.",
  ],
);

const converter = define(
  "audio-converter",
  "Audio Converter",
  [
    { name: "file", label: "Audio file", control: "file", accept: ACCEPT },
    { name: "format", label: "Output format", control: "select", options: ["wav", "webm"] },
    { name: "bitrate", label: "WebM bitrate", control: "select", options: ["96", "128", "192"], optional: true },
  ],
  [
    "16-bit PCM WAV output",
    "WebM/Opus output via MediaRecorder",
    "Real-time recording progress",
    "Output size, format, duration and sample rate",
  ],
  { format: "wav", bitrate: 128 },
  [
    "WAV uses the existing dependency-free 16-bit PCM encoder. WebM/Opus renders through OfflineAudioContext, then records in real time through MediaStreamAudioDestinationNode and MediaRecorder.",
    "If the browser does not support audio/webm;codecs=opus, the WebM option is disabled with a visible message. The chosen format is never silently changed and no different codec is substituted.",
    "MP3 encoding is not available in this release. Cancel stops the recorder, stops the source, disconnects the nodes and closes the AudioContext.",
  ],
);

export const audioTools = [
  {
    ...trimmer,
    keywords: [...trimmer.keywords, "audio", "trimmer", "cutter", "trim", "wav", "waveform", "playback"],
    relatedTools: ["audio-compressor", "audio-merger", "audio-converter"],
  },
  {
    ...compressor,
    description:
      "Compress one local audio file with threshold, ratio, attack, release, knee and makeup gain, then compare input/output peak, RMS and measured gain reduction and download a 16-bit PCM WAV.",
    keywords: [...compressor.keywords, "audio", "compressor", "dynamics", "threshold", "ratio", "attack", "release", "knee", "makeup", "gain", "wav"],
    relatedTools: ["audio-trimmer", "audio-merger", "audio-converter"],
    seo: {
      ...compressor.seo,
      description:
        "Compress audio locally with an offline DynamicsCompressorNode chain. Set threshold, ratio, attack, release, knee and makeup gain; compare peak, RMS and gain reduction; download a 16-bit PCM WAV.",
    },
  },
  {
    ...merger,
    description:
      "Join two or more local audio files in a chosen order, normalise them to the highest sample rate and two channels, insert an optional 0–5 second silence gap, and download one 16-bit PCM WAV.",
    keywords: [...merger.keywords, "audio", "merger", "join", "concatenate", "combine", "gap", "silence", "wav"],
    relatedTools: ["audio-trimmer", "audio-compressor", "audio-converter"],
    seo: {
      ...merger.seo,
      description:
        "Merge two or more audio files locally in the listed order, with keyboard reordering, optional 0–5 second gaps, sample-rate normalisation, mono duplication and a 30-minute cap. Download one WAV.",
    },
  },
  {
    ...converter,
    description:
      "Convert one local audio file to 16-bit PCM WAV or WebM/Opus, with an explicit WebM bitrate, real-time recording progress, Cancel, and output size, format, duration and sample rate. MP3 is not available.",
    keywords: [...converter.keywords, "audio", "converter", "convert", "wav", "webm", "opus", "bitrate", "mediarecorder"],
    relatedTools: ["audio-trimmer", "audio-compressor", "audio-merger"],
    seo: {
      ...converter.seo,
      description:
        "Convert audio locally to 16-bit PCM WAV or WebM/Opus. WebM uses a real-time MediaRecorder with 96/128/192 kbps, visible progress and Cancel. MP3 is not available and formats are never silently changed.",
    },
  },
];

export const getAudioDefinition = (id: string) => audioTools.find(tool => tool.id === id);

export const isAudioToolId = (id: string): id is AudioToolId =>
  (audioToolIds as readonly string[]).includes(id);
