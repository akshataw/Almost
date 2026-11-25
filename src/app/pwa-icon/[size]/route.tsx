import { ImageResponse } from "next/og";

const SIZES = { "192": 192, "512": 512, maskable: 512 } as const;

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

/** App icons for the PWA manifest: a 3×3 dot grid where one dot is slightly larger. */
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: key } = await ctx.params;
  const size = SIZES[key as keyof typeof SIZES];
  if (!size) return new Response("Not found", { status: 404 });
  const maskable = key === "maskable";
  const inner = maskable ? size * 0.6 : size * 0.72; // maskable keeps content in the safe zone
  const dot = inner / 5;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111318", borderRadius: maskable ? 0 : size * 0.22 }}>
        <div style={{ width: inner, height: inner, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", alignContent: "space-between" }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{ width: inner / 3, height: inner / 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: i === 5 ? dot * 1.25 : dot, height: i === 5 ? dot * 1.25 : dot, borderRadius: dot, background: i === 5 ? "#d8a94f" : "#f2f0e9" }} />
            </div>
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
