"use client";

import VideoThumbnailTool from "./VideoThumbnailTool";
import VideoTrimmerTool from "./VideoTrimmerTool";
import type { VideoToolId } from "@/config/video-tools";

export default function VideoStation({ toolId }: { toolId: VideoToolId }) {
  if (toolId === "video-thumbnail-generator") return <VideoThumbnailTool />;
  if (toolId === "video-trimmer") return <VideoTrimmerTool />;
  return null;
}
