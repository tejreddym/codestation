import { ImageResponse } from "next/og";
import { resolveOgCardData } from "@/lib/og/card-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const card = resolveOgCardData({
    type: searchParams.get("type"),
    slug: searchParams.get("slug"),
  });

  const titleFontSize = card.title.length > 32 ? 46 : card.title.length > 22 ? 54 : 62;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px",
          backgroundColor: "#f6f5f1",
          color: "#151713",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "46px 52px",
            backgroundColor: "#ffffff",
            border: "2px solid #d3d6ca",
            borderRadius: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 16px",
                borderRadius: "999px",
                backgroundColor: "#eaf1d9",
                border: "1px solid #a3bb57",
                color: "#476511",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              <span>{card.badge}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 16px",
                borderRadius: "999px",
                backgroundColor: "#eeeee7",
                border: "1px solid #d3d6ca",
                color: "#151713",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  backgroundColor: "#147d64",
                }}
              />
              <span>{card.footerBadge}</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              marginTop: "24px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: `${titleFontSize}px`,
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: "-0.025em",
                color: "#151713",
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "27px",
                lineHeight: 1.4,
                color: "#596153",
              }}
            >
              {card.description}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "22px",
              borderTop: "2px solid #eeeee7",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  backgroundColor: "#d9f975",
                  border: "1px solid #a3bb57",
                  color: "#151713",
                  fontSize: "20px",
                  fontWeight: 800,
                }}
              >
                CS
              </div>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#151713",
                }}
              >
                Code Station
              </span>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: "22px",
                fontWeight: 600,
                color: "#476511",
              }}
            >
              {card.brandHost}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  );
}
