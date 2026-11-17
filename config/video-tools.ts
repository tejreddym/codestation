import { localDefinition, type LocalDefinition, type LocalField } from "./local-contract";

const file = (label: string, accept: string): LocalField => ({ name: "file", label, control: "file", accept });
const number = (name: string, label: string, min: number, max: number, optional = false): LocalField => ({ name, label, control: "number", min, max, optional });
const select = (name: string, label: string, options: string[]): LocalField => ({ name, label, control: "select", options });

export const videoToolIds = ["video-thumbnail-generator"] as const;
export type VideoToolId = typeof videoToolIds[number];

export const videoTools: readonly LocalDefinition<VideoToolId>[] = [
  {
    ...localDefinition<VideoToolId>(
      "video-thumbnail-generator",
      "Video Thumbnail Generator",
      "Video",
      [
        file("Video file", "video/*,.mp4,.webm,.mov,.m4v,.ogv"),
        number("frames", "Evenly spaced frames", 1, 12),
        select("format", "Image format", ["png", "jpeg"]),
        number("quality", "JPEG quality", 1, 100),
        select("maxWidth", "Maximum width", ["original", "1920", "1280", "640"]),
      ],
      ["PNG or JPEG thumbnails", "ZIP archive of all captured frames"],
      { frames: "3", format: "png", quality: "92", maxWidth: "original" },
      [
        "Videos are decoded locally by this browser and never uploaded. Capture works only for formats and codecs this browser can decode; unsupported files fail without a fallback encoder.",
        "Captured frames are still images only. Audio is never analysed, preserved or attached.",
        "The playhead frame and evenly spaced samples are fixed snapshots. Very short clips may repeat the same decoded frame. All output is clamped to 4096 px per side with no upscaling.",
      ],
      "Capture frames",
    ),
    description: "Capture a single frame at the playhead or evenly spaced thumbnails from a local video, then download PNG/JPEG images or a ZIP archive. Decoding and capture stay in your browser.",
    keywords: ["video", "thumbnail", "frame", "screenshot", "poster", "mp4", "webm", "zip"],
    relatedTools: ["image-compressor", "image-resizer", "image-cropper"],
    seo: {
      title: "Video Thumbnail Generator — Local Frame Capture",
      description: "Capture frames from a local MP4, WebM, MOV, M4V or OGV video and download PNG/JPEG thumbnails or a ZIP archive without uploading the video.",
    },
  },
];

export const getVideoDefinition = (id: string) => videoTools.find(tool => tool.id === id);
export const isVideoToolId = (id: string): id is VideoToolId => (videoToolIds as readonly string[]).includes(id);
