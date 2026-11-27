import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FIRE App",
    short_name: "FIRE",
    description: "First In Response Exteriors business app.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1b2f",
    theme_color: "#0d1b2f",
    icons: [
      {
        src: "/fire-app-home-v2.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/fire-app-home-512-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
