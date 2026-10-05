export type ServiceType = "trip_documents";

export type ServiceUploadStatus = "uploaded" | "reviewed" | "processed" | "re_upload_requested";

export interface Service {
  id: string;
  tripId: string;
  clientId: string;
  serviceType: ServiceType;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface ServiceChecklistItem {
  id: string;
  serviceId: string;
  label: string;
  required: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceUpload {
  id: string;
  serviceId: string;
  checklistItemId: string;
  filePath: string;
  filename: string;
  mimeType?: string;
  status: ServiceUploadStatus;
  agentComment?: string;
  fileRemoved: boolean;
  uploadedAt: string;
  updatedAt: string;
}

export interface ServiceChecklistItemWithUpload extends ServiceChecklistItem {
  upload?: ServiceUpload & { url: string | null };
}

export interface ServiceWithChecklist extends Service {
  items: ServiceChecklistItemWithUpload[];
}

export interface ServiceDocumentSummary {
  serviceId: string;
  clientId: string;
  processed: number;
  total: number;
  awaitingReview: number;
}
