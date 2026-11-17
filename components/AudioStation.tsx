"use client";

import type { AudioToolId } from "@/config/audio-tools";
import AudioCompressorTool from "./AudioCompressorTool";
import AudioConverterTool from "./AudioConverterTool";
import AudioMergerTool from "./AudioMergerTool";
import AudioTrimmerTool from "./AudioTrimmerTool";

export default function AudioStation({ toolId }: { toolId: AudioToolId }) {
  if (toolId === "audio-compressor") return <AudioCompressorTool />;
  if (toolId === "audio-merger") return <AudioMergerTool />;
  if (toolId === "audio-converter") return <AudioConverterTool />;
  return <AudioTrimmerTool />;
}
