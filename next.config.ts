import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Los documentos (Word/PDF) superan el límite por defecto de 1MB de los
      // Server Actions. Subir un Word grande reventaba con "Algo salió mal".
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
