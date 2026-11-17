"use client";

import VideoThumbnailTool from "./VideoThumbnailTool";
import type { VideoToolId } from "@/config/video-tools";

export default function VideoStation({ toolId }: { toolId: VideoToolId }) {
  if (toolId !== "video-thumbnail-generator") return null;
  return <VideoThumbnailTool />;
}
