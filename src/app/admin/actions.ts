"use server";

import { revalidatePath } from "next/cache";

import { catalogImageStorage } from "@/lib/admin/image-storage";
import { type AdminActionState, AdminOperationError } from "@/lib/admin/types";
import {
  isUuid,
  validateArtistAdminInput,
  validateCategoryAdminInput,
  validateProductAdminInput,
  validateShippingProfileAdminInput,
  validateStockAdminInput,
  validateVariationAdminInput,
} from "@/lib/admin/validation";
import {
  validateFinancialChargeRuleInput,
  validateFinancialPolicyInput,
  validateProductFinancialPricingInput,
} from "@/lib/financial/validation";
import { adminCatalog } from "@/lib/server/admin/catalog";
import { requireAdminSession } from "@/lib/server/auth-session";
import { financialService } from "@/lib/server/financial/service";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function validationError(result: {
  message: string;
  fieldErrors: Record<string, string[]>;
}): AdminActionState {
  return {
    status: "error",
    message: result.message,
    fieldErrors: result.fieldErrors,
  };
}

function operationError(error: unknown): AdminActionState {
  if (error instanceof AdminOperationError) {
    return { status: "error", message: error.message };
  }

  return {
    status: "error",
    message: "Não foi possível concluir a operação. Tente novamente.",
  };
}

function invalidId(message: string): AdminActionState {
  return { status: "error", message };
}

function refreshAdminCatalog(): void {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/produtos/[slug]", "page");
  revalidatePath("/artistas");
  revalidatePath("/artistas/[slug]", "page");
  revalidatePath("/categorias");
  revalidatePath("/categorias/[slug]", "page");
}

export async function createArtistAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const result = validateArtistAdminInput({
    artisticName: formData.get("artisticName"),
    biography: formData.get("biography"),
    photoPath: formData.get("photoPath"),
    instagramHandle: formData.get("instagramHandle"),
    isActive: formData.get("isActive"),
  });
  if (!result.success) return validationError(result);

  try {
    await adminCatalog.createArtist(result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Artista cadastrado com sucesso." };
  } catch (error) {
    return operationError(error);
  }
}

export async function updateArtistAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Artista inválido.");
  const result = validateArtistAdminInput({
    artisticName: formData.get("artisticName"),
    biography: formData.get("biography"),
    photoPath: formData.get("photoPath"),
    instagramHandle: formData.get("instagramHandle"),
    isActive: formData.get("isActive"),
  });
  if (!result.success) return validationError(result);

  try {
    await adminCatalog.updateArtist(id, result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Artista atualizado com sucesso." };
  } catch (error) {
    return operationError(error);
  }
}

export async function setArtistStatusAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Artista inválido.");
  const active = text(formData, "active") === "true";
  try {
    await adminCatalog.setArtistActive(id, active);
    refreshAdminCatalog();
    return {
      status: "success",
      message: active ? "Artista ativado." : "Artista desativado.",
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function createCategoryAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const result = validateCategoryAdminInput({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    parentId: formData.get("parentId"),
    displayOrder: formData.get("displayOrder"),
  });
  if (!result.success) return validationError(result);

  try {
    await adminCatalog.createCategory(result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Categoria criada com sucesso." };
  } catch (error) {
    return operationError(error);
  }
}

export async function updateCategoryAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Categoria inválida.");
  const result = validateCategoryAdminInput({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    parentId: formData.get("parentId"),
    displayOrder: formData.get("displayOrder"),
    currentId: id,
  });
  if (!result.success) return validationError(result);

  try {
    await adminCatalog.updateCategory(id, result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Categoria atualizada com sucesso." };
  } catch (error) {
    return operationError(error);
  }
}

export async function deleteCategoryAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Categoria inválida.");
  try {
    await adminCatalog.deleteCategory(id);
    refreshAdminCatalog();
    return { status: "success", message: "Categoria removida." };
  } catch (error) {
    return operationError(error);
  }
}

function readProductValidation(formData: FormData) {
  return validateProductAdminInput({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    artistId: formData.get("artistId"),
    categoryIds: formData.getAll("categoryIds"),
    material: formData.get("material"),
    productionTechnique: formData.get("productionTechnique"),
    price: formData.get("price"),
    publicationStatus: formData.get("publicationStatus"),
  });
}

export async function createProductAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdminSession();
  const result = readProductValidation(formData);
  if (!result.success) return validationError(result);
  try {
    const product = await adminCatalog.createProduct(result.data);
    const artistCost = text(formData, "artistCost");
    if (artistCost && product) {
      const financial = validateProductFinancialPricingInput({
        productId: product.id,
        variationId: "",
        artistCost,
        policyId: formData.get("financialPolicyId"),
        paymentMethod: "pending",
        paymentFeeRuleId: "",
        taxRuleId: "",
      });
      if (!financial.success) return validationError(financial);
      await financialService.savePricing(financial.data, session.user.id);
    }
    refreshAdminCatalog();
    return {
      status: "success",
      message: "Produto salvo como rascunho com sucesso.",
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function updateProductAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Produto inválido.");
  const result = readProductValidation(formData);
  if (!result.success) return validationError(result);
  try {
    await adminCatalog.updateProduct(id, result.data);
    const artistCost = text(formData, "artistCost");
    if (artistCost) {
      const financial = validateProductFinancialPricingInput({
        productId: id,
        variationId: "",
        artistCost,
        policyId: formData.get("financialPolicyId"),
        paymentMethod: "pending",
        paymentFeeRuleId: "",
        taxRuleId: "",
      });
      if (!financial.success) return validationError(financial);
      await financialService.savePricing(financial.data, session.user.id);
    }
    refreshAdminCatalog();
    return { status: "success", message: "Produto atualizado com sucesso." };
  } catch (error) {
    return operationError(error);
  }
}

export async function setProductStatusAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Produto inválido.");
  const value = text(formData, "status");
  if (value !== "draft" && value !== "published" && value !== "archived") {
    return invalidId("Status de publicação inválido.");
  }
  try {
    await adminCatalog.setProductStatus(id, value);
    refreshAdminCatalog();
    return {
      status: "success",
      message:
        value === "published"
          ? "Produto publicado."
          : value === "archived"
            ? "Produto arquivado."
            : "Produto movido para rascunho.",
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function createVariationAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const result = validateVariationAdminInput({
    productId: formData.get("productId"),
    sku: formData.get("sku"),
    color: formData.get("color"),
    size: formData.get("size"),
    availableQuantity: formData.get("availableQuantity"),
    specificPrice: formData.get("specificPrice"),
    isActive: formData.get("isActive"),
    isDefault: formData.get("isDefault"),
  });
  if (!result.success) return validationError(result);
  try {
    await adminCatalog.createVariation(result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Variação adicionada." };
  } catch (error) {
    return operationError(error);
  }
}

export async function updateVariationAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Variação inválida.");
  const result = validateVariationAdminInput({
    productId: formData.get("productId"),
    sku: formData.get("sku"),
    color: formData.get("color"),
    size: formData.get("size"),
    availableQuantity: formData.get("availableQuantity"),
    specificPrice: formData.get("specificPrice"),
    isActive: formData.get("isActive"),
    isDefault: formData.get("isDefault"),
  });
  if (!result.success) return validationError(result);
  try {
    await adminCatalog.updateVariation(id, result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Variação atualizada." };
  } catch (error) {
    return operationError(error);
  }
}

export async function updateStockAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const result = validateStockAdminInput({
    variationId: formData.get("variationId"),
    availableQuantity: formData.get("availableQuantity"),
    expectedAvailableQuantity: formData.get("expectedAvailableQuantity"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!result.success) return validationError(result);
  try {
    await adminCatalog.updateStock(result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Estoque atualizado com segurança." };
  } catch (error) {
    return operationError(error);
  }
}

export async function upsertShippingProfileAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const result = validateShippingProfileAdminInput({
    productId: formData.get("productId"),
    variationId: formData.get("variationId"),
    itemWeightGrams: formData.get("itemWeightGrams"),
    itemHeightCm: formData.get("itemHeightCm"),
    itemWidthCm: formData.get("itemWidthCm"),
    itemLengthCm: formData.get("itemLengthCm"),
    packageWeightGrams: formData.get("packageWeightGrams"),
    packageHeightCm: formData.get("packageHeightCm"),
    packageWidthCm: formData.get("packageWidthCm"),
    packageLengthCm: formData.get("packageLengthCm"),
    isFragile: formData.get("isFragile"),
    shipsSeparately: formData.get("shipsSeparately"),
    unitsPerPackage: formData.get("unitsPerPackage"),
  });
  if (!result.success) return validationError(result);
  try {
    await adminCatalog.upsertShippingProfile(result.data);
    refreshAdminCatalog();
    return { status: "success", message: "Logística atualizada." };
  } catch (error) {
    return operationError(error);
  }
}

export async function requestImageUploadAction(
  _state: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  if (!catalogImageStorage.configured) {
    return {
      status: "error",
      message:
        "Upload indisponível até um armazenamento privado ser autorizado e configurado.",
    };
  }
  return { status: "error", message: "Upload não disponível nesta etapa." };
}

export async function removeImageMetadataAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Imagem inválida.");
  try {
    await adminCatalog.removeImageMetadata(id);
    refreshAdminCatalog();
    return { status: "success", message: "Vínculo da imagem removido." };
  } catch (error) {
    return operationError(error);
  }
}

export async function createFinancialPolicyAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdminSession();
  const result = validateFinancialPolicyInput({
    code: formData.get("code"),
    version: formData.get("version"),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveUntil: formData.get("effectiveUntil"),
    source: formData.get("source"),
    approve: formData.get("approve"),
  });
  if (!result.success) return validationError(result);
  try {
    await financialService.createPolicy(result.data, session.user.id);
    refreshAdminCatalog();
    return {
      status: "success",
      message: result.data.approve
        ? "Política aprovada e registrada como imutável."
        : "Política salva como rascunho.",
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function createFinancialChargeRuleAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdminSession();
  const result = validateFinancialChargeRuleInput({
    kind: formData.get("kind"),
    name: formData.get("name"),
    paymentMethod: formData.get("paymentMethod"),
    percentage: formData.get("percentage"),
    fixedAmount: formData.get("fixedAmount"),
    incidenceBase: formData.get("incidenceBase"),
    applicationScope: formData.get("applicationScope"),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveUntil: formData.get("effectiveUntil"),
    source: formData.get("source"),
    approve: formData.get("approve"),
  });
  if (!result.success) return validationError(result);
  try {
    await financialService.createRule(result.data, session.user.id);
    refreshAdminCatalog();
    return {
      status: "success",
      message: result.data.approve
        ? "Regra aprovada e registrada como imutável."
        : "Regra salva como rascunho.",
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function saveProductFinancialPricingAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdminSession();
  const result = validateProductFinancialPricingInput({
    productId: formData.get("productId"),
    variationId: formData.get("variationId"),
    artistCost: formData.get("artistCost"),
    policyId: formData.get("policyId"),
    paymentMethod: formData.get("paymentMethod"),
    paymentFeeRuleId: formData.get("paymentFeeRuleId"),
    taxRuleId: formData.get("taxRuleId"),
    isDefault: formData.get("isDefault"),
  });
  if (!result.success) return validationError(result);
  try {
    const saved = await financialService.savePricing(
      result.data,
      session.user.id,
    );
    refreshAdminCatalog();
    return {
      status: "success",
      message: saved.scenario
        ? "Cálculo salvo como pendente de validação humana."
        : "Custo salvo; taxas ou tributos aprovados ainda estão pendentes.",
    };
  } catch (error) {
    return operationError(error);
  }
}

export async function validateProductPricingScenarioAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdminSession();
  const id = text(formData, "id");
  if (!isUuid(id)) return invalidId("Cenário de precificação inválido.");
  try {
    await financialService.validateScenario(id, session.user.id);
    refreshAdminCatalog();
    return {
      status: "success",
      message: "Precificação validada e preço do catálogo sincronizado.",
    };
  } catch (error) {
    return operationError(error);
  }
}
