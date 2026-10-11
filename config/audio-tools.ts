import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const audioToolIds = ["audio-trimmer"] as const;

export type AudioToolId = (typeof audioToolIds)[number];

const notice =
  "Zero-server audio processing. Audio waveform decoding, playback, and WAV rendering execute 100% locally in your browser with Web Audio API.";

const define = (
  id: AudioToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<AudioToolId> =>
  localDefinition(id, title, "Audio", fields, outputs, defaults, [notice, ...extra], "Process");

export const audioTools: readonly LocalDefinition<AudioToolId>[] = [
  define(
    "audio-trimmer",
    "Audio Trimmer & Cutter",
    [
      {
        name: "file",
        label: "Audio file",
        control: "file",
        accept: "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac",
      },
    ],
    ["Waveform visualization", "Audio playback preview", "Trimmed WAV Download"],
    {},
    [
      "Trim, cut, and slice audio files with live waveform visualization and instant 16-bit PCM WAV export. Zero uploads, zero latency.",
    ]
  ),
];

export const getAudioDefinition = (id: string) => audioTools.find((tool) => tool.id === id);
export const isAudioToolId = (id: string): id is AudioToolId =>
  (audioToolIds as readonly string[]).includes(id);
