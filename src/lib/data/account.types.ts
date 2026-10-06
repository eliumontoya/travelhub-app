export type AccountRole = "admin" | "agent";

export type Feature =
  | "trips"
  | "clients"
  | "suppliers"
  | "travel-agents"
  | "whatsapp"
  | "settings"
  | "visas";

export interface AccountProfile {
  id: string;
  role: AccountRole;
  features: Feature[];
  travelAgentId?: string;
  email?: string;
  travelAgentName?: string;
}
