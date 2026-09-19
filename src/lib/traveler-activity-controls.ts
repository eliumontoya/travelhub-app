type TravelerActivityControlsEligibility = {
  tripStatus: string;
  clientId: string | null | undefined;
  hasAssignment: boolean;
};

export function canRenderTravelerActivityControls({
  tripStatus,
  clientId,
  hasAssignment,
}: TravelerActivityControlsEligibility): boolean {
  return tripStatus === "published" && Boolean(clientId) && hasAssignment;
}
