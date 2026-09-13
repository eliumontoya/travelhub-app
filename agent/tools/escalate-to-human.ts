import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Escala la conversación a un agente humano de TravelHub. Usar cuando el cliente solicite cotizaciones, pagos, cancelaciones, emergencias, o cuando no puedas resolver su solicitud con seguridad. Después de escalar, informa al cliente que un asesor le dará seguimiento.",
  inputSchema: z.object({
    reason: z.string().min(1).max(500).describe("Motivo breve de la escalación"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal").describe("Prioridad de la escalación"),
  }),
  async execute({ reason, priority }: { reason: string; priority: string }) {
    return {
      success: true,
      escalated: true,
      reason,
      priority,
      message: "La conversación ha sido escalada a un asesor de TravelHub.",
    };
  },
});
