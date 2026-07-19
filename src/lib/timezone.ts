// No hay paquete de zonas horarias IANA en node_modules (verificado en package.json)
// y agregar uno solo para esto sería una dependencia pesada. En vez de eso,
// aproximamos el huso horario del destino a partir de la longitud: cada 15°
// equivalen a ~1 hora de diferencia respecto a UTC. Es una aproximación (no
// respeta fronteras políticas de husos horarios), por eso el resultado se
// etiqueta como "aprox.".
export function getApproxUtcOffsetLabel(
  lat?: number,
  lng?: number
): string | null {
  if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  const offset = Math.round(lng / 15);
  const sign = offset >= 0 ? "+" : "";
  return `UTC${sign}${offset} (aprox.)`;
}
