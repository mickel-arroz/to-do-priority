import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "To-Do Priority",
    short_name: "To-Do Priority",
    description:
      "Tareas con matriz de prioridad, hábitos y pomodoro | Tasks with priority matrix, habits and pomodoro",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#066f72",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
