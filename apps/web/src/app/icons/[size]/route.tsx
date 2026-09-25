import { ImageResponse } from "next/og";
import { staticSVG } from "roby-face/engine";

// Icone della PWA: il volto di Roby, generato da roby-face al build. A tutto campo, così regge anche la maschera
// di Android (maskable): gli occhi stanno ben dentro la zona sicura centrale.
export const dynamic = "force-static";
export const generateStaticParams = () => ["180", "192", "512"].map((size) => ({ size }));

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  const svg = Buffer.from(staticSVG("happy", { radius: 0 })).toString("base64");
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- dentro ImageResponse serve <img>
    <img src={`data:image/svg+xml;base64,${svg}`} width={size} height={size} alt="" />,
    { width: size, height: size },
  );
}
