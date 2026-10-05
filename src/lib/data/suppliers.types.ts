export interface Supplier {
  id: string;
  name: string;
  type: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  address?: string;
  lat?: number;
  lng?: number;
  googlePlaceId?: string;
  notes?: string;
  tags: string[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
