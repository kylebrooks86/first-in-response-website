import type { MetadataRoute } from "next";
import { FIRE_APP_VERSION } from "../lib/app-version";

/** Separate installed Home Screen identity: never masquerade as the LIVE FIRE app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/fire-new-live-v1",
    name: "FIRE NEW LIVE - Isolated",
    short_name: "FIRE New Live",
    description: "Isolated NEW LIVE FIRE Business App release candidate.",
    start_url: `/?release=new-live&app=${FIRE_APP_VERSION}`,
    display: "standalone",
    background_color: "#0d1b2f",
    theme_color: "#0d1b2f",
    icons: [
      { src: "/fire-app-home-v2.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/fire-app-home-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
