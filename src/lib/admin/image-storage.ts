import { AdminOperationError } from "@/lib/admin/types";

export interface StoredCatalogImage {
  filePath: string;
  contentType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
  sizeInBytes: number;
}

export interface CatalogImageStorage {
  readonly configured: boolean;
  store(input: {
    productId: string;
    fileName: string;
    contentType: StoredCatalogImage["contentType"];
    bytes: Uint8Array;
  }): Promise<StoredCatalogImage>;
  remove(filePath: string): Promise<void>;
}

export class UnavailableCatalogImageStorage implements CatalogImageStorage {
  readonly configured = false;

  async store(): Promise<never> {
    throw new AdminOperationError(
      "STORAGE_UNAVAILABLE",
      "O armazenamento de imagens ainda não está configurado.",
    );
  }

  async remove(): Promise<never> {
    throw new AdminOperationError(
      "STORAGE_UNAVAILABLE",
      "O armazenamento de imagens ainda não está configurado.",
    );
  }
}

export const catalogImageStorage = new UnavailableCatalogImageStorage();
