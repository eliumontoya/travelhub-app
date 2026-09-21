import type { NextConfig } from "next";
import path from "node:path";

const turbopackRoot = path.resolve(
  path.dirname(require.resolve("next/package.json")),
  "../..",
);

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  experimental: {
    serverActions: {
      // Los documentos (Word/PDF) superan el límite por defecto de 1MB de los
      // Server Actions. Subir un Word grande reventaba con "Algo salió mal".
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
