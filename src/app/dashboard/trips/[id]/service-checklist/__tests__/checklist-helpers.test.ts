import { describe, expect, it } from "vitest";
import type {
  ServiceChecklistItemWithUpload,
  ServiceUploadStatus,
} from "@/types";
import { itemHasReviewableUpload, statusLabel } from "../useServiceChecklist";

function itemWithStatus(
  status?: ServiceUploadStatus,
): ServiceChecklistItemWithUpload {
  const base = {
    id: "item-1",
    serviceId: "service-1",
    label: "Pasaporte",
    required: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  if (!status) return base;

  return {
    ...base,
    upload: {
      id: "upload-1",
      serviceId: "service-1",
      checklistItemId: "item-1",
      filePath: "trips/service-1/item-1/passport.pdf",
      filename: "passport.pdf",
      mimeType: "application/pdf",
      status,
      fileRemoved: false,
      uploadedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      url: "https://example.test/passport.pdf",
    },
  };
}

describe("statusLabel", () => {
  it("maps every upload status to its exact icon and text", () => {
    expect(statusLabel(itemWithStatus("processed"))).toEqual({
      icon: "✓",
      text: "Procesado",
    });
    expect(statusLabel(itemWithStatus("reviewed"))).toEqual({
      icon: "✓",
      text: "Revisado",
    });
    expect(statusLabel(itemWithStatus("re_upload_requested"))).toEqual({
      icon: "!",
      text: "Re-subir solicitado",
    });
    expect(statusLabel(itemWithStatus("uploaded"))).toEqual({
      icon: "↻",
      text: "Pendiente de revisión",
    });
  });

  it("falls back to the pending label when there is no upload", () => {
    expect(statusLabel(itemWithStatus())).toEqual({
      icon: "□",
      text: "Pendiente",
    });
  });
});

describe("itemHasReviewableUpload", () => {
  it("is true only for the uploaded status", () => {
    expect(itemHasReviewableUpload(itemWithStatus("uploaded"))).toBe(true);
    expect(itemHasReviewableUpload(itemWithStatus("processed"))).toBe(false);
    expect(itemHasReviewableUpload(itemWithStatus("reviewed"))).toBe(false);
    expect(itemHasReviewableUpload(itemWithStatus("re_upload_requested"))).toBe(
      false,
    );
    expect(itemHasReviewableUpload(itemWithStatus())).toBe(false);
  });
});
