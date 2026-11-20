import "server-only";

import {
  addProductImageMetadata,
  createArtist,
  createCategory,
  createProduct,
  createVariation,
  deleteCategory,
  getAdminDashboard,
  getArtistDetail,
  getCategoryDetail,
  getProductDetail,
  listArtistOptions,
  listArtists,
  listCategories,
  listCategoryOptions,
  listProducts,
  listStock,
  removeProductImageMetadata,
  setArtistActive,
  setProductPublicationStatus,
  updateArtist,
  updateCategory,
  updateProduct,
  updateVariation,
  updateVariationStock,
  upsertShippingProfile,
} from "@/lib/admin/catalog-repository";
import { database } from "@/lib/server/database";

export const adminCatalog = {
  dashboard: () => getAdminDashboard(database),
  listArtists: (input: Parameters<typeof listArtists>[1]) =>
    listArtists(database, input),
  artist: (id: string) => getArtistDetail(database, id),
  createArtist: (input: Parameters<typeof createArtist>[1]) =>
    createArtist(database, input),
  updateArtist: (id: string, input: Parameters<typeof updateArtist>[2]) =>
    updateArtist(database, id, input),
  setArtistActive: (id: string, active: boolean) =>
    setArtistActive(database, id, active),
  listCategories: (input: Parameters<typeof listCategories>[1]) =>
    listCategories(database, input),
  category: (id: string) => getCategoryDetail(database, id),
  categoryOptions: (excludeId?: string) =>
    listCategoryOptions(database, excludeId),
  createCategory: (input: Parameters<typeof createCategory>[1]) =>
    createCategory(database, input),
  updateCategory: (id: string, input: Parameters<typeof updateCategory>[2]) =>
    updateCategory(database, id, input),
  deleteCategory: (id: string) => deleteCategory(database, id),
  listProducts: (input: Parameters<typeof listProducts>[1]) =>
    listProducts(database, input),
  product: (id: string) => getProductDetail(database, id),
  artistOptions: () => listArtistOptions(database),
  createProduct: (input: Parameters<typeof createProduct>[1]) =>
    createProduct(database, input),
  updateProduct: (id: string, input: Parameters<typeof updateProduct>[2]) =>
    updateProduct(database, id, input),
  setProductStatus: (
    id: string,
    status: Parameters<typeof setProductPublicationStatus>[2],
  ) => setProductPublicationStatus(database, id, status),
  createVariation: (input: Parameters<typeof createVariation>[1]) =>
    createVariation(database, input),
  updateVariation: (id: string, input: Parameters<typeof updateVariation>[2]) =>
    updateVariation(database, id, input),
  listStock: (input: Parameters<typeof listStock>[1]) =>
    listStock(database, input),
  updateStock: (input: Parameters<typeof updateVariationStock>[1]) =>
    updateVariationStock(database, input),
  addImageMetadata: (input: Parameters<typeof addProductImageMetadata>[1]) =>
    addProductImageMetadata(database, input),
  removeImageMetadata: (id: string) => removeProductImageMetadata(database, id),
  upsertShippingProfile: (input: Parameters<typeof upsertShippingProfile>[1]) =>
    upsertShippingProfile(database, input),
};
