"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { IBackofficePricingService } from "../services/IBackofficePricingService"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type {
  BackofficeAdhesionBillingCycleKey,
  BackofficeProductFormData,
  BackofficeProductItem,
  BackofficeProductPaymentRuleFormEntry,
  BackofficeProductPaymentRuleItem,
} from "./BackofficePricingTypes"
import { EMPTY_PRODUCT_FORM } from "./BackofficePricingTypes"
import { toast } from "sonner"

interface PricingContextValue {
  products: BackofficeProductItem[]
  availableFeatureSlugs: string[]
  isLoading: boolean
  canManage: boolean

  dialogOpen: boolean
  dialogMode: "create" | "edit" | "duplicate"
  dialogProduct: BackofficeProductItem | null
  formData: BackofficeProductFormData
  isSaving: boolean
  openCreateDialog: () => void
  openEditDialog: (product: BackofficeProductItem) => void
  openDuplicateDialog: (product: BackofficeProductItem) => void
  closeDialog: () => void
  setFormField: (field: keyof BackofficeProductFormData, value: string | boolean) => void
  setPaymentRuleField: (
    cycle: BackofficeAdhesionBillingCycleKey,
    field: keyof BackofficeProductPaymentRuleFormEntry,
    value: string
  ) => void
  submitForm: () => Promise<void>

  deleteDialogOpen: boolean
  deleteProduct: BackofficeProductItem | null
  isDeleting: boolean
  openDeleteDialog: (product: BackofficeProductItem) => void
  closeDeleteDialog: () => void
  confirmDelete: () => Promise<void>
}

function productToFormData(product: BackofficeProductItem): BackofficeProductFormData {
  function findRule(
    cycle: BackofficeAdhesionBillingCycleKey,
    method: "PIX" | "CREDIT_CARD"
  ): BackofficeProductPaymentRuleItem | undefined {
    return product.paymentRules.find((r) => r.billingCycle === cycle && r.paymentMethod === method)
  }
  function ruleEntry(cycle: BackofficeAdhesionBillingCycleKey, defaultMax: string): BackofficeProductPaymentRuleFormEntry {
    const pix = findRule(cycle, "PIX")
    const card = findRule(cycle, "CREDIT_CARD")
    return {
      pixPrice: pix ? String(pix.price) : "",
      cardPrice: card ? String(card.price) : "",
      maxInstallments: card ? String(card.maxInstallments) : defaultMax,
    }
  }

  return {
    name: product.name,
    featureSlug: product.featureSlug,
    description: product.description ?? "",
    type: product.type,
    billingMode: product.billingMode,
    priceMonthly: product.priceMonthly != null ? String(product.priceMonthly) : "",
    priceQuarterly: product.priceQuarterly != null ? String(product.priceQuarterly) : "",
    priceSemiannual: product.priceSemiannual != null ? String(product.priceSemiannual) : "",
    priceAnnual: product.priceAnnual != null ? String(product.priceAnnual) : "",
    priceLifetime: product.priceLifetime != null ? String(product.priceLifetime) : "",
    isDefault: product.isDefault,
    isActive: product.isActive,
    paymentRules: {
      monthly: ruleEntry("monthly", "1"),
      quarterly: ruleEntry("quarterly", "3"),
      semiannual: ruleEntry("semiannual", "6"),
      annual: ruleEntry("annual", "12"),
    },
  }
}

const BackofficePricingContext = createContext<PricingContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  pricingService: IBackofficePricingService
}

export function BackofficePricingProvider({ children, pricingService }: Props) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const [products, setProducts] = useState<BackofficeProductItem[]>([])
  const [availableFeatureSlugs, setAvailableFeatureSlugs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "duplicate">("create")
  const [dialogProduct, setDialogProduct] = useState<BackofficeProductItem | null>(null)
  const [formData, setFormData] = useState<BackofficeProductFormData>(EMPTY_PRODUCT_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteProduct, setDeleteProduct] = useState<BackofficeProductItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const inFlight = useRef(false)

  const loadProducts = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    try {
      const [items, slugs] = await Promise.all([
        pricingService.list(),
        pricingService.listFeatureSlugs(),
      ])
      setProducts(items)
      setAvailableFeatureSlugs(slugs)
    } catch (err) {
      console.error("[BackofficePricingContext]", err)
      toast.error("Erro ao carregar produtos")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [pricingService])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const openCreateDialog = useCallback(() => {
    setDialogMode("create")
    setDialogProduct(null)
    setFormData(EMPTY_PRODUCT_FORM)
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((product: BackofficeProductItem) => {
    setDialogMode("edit")
    setDialogProduct(product)
    setFormData(productToFormData(product))
    setDialogOpen(true)
  }, [])

  const openDuplicateDialog = useCallback((product: BackofficeProductItem) => {
    setDialogMode("duplicate")
    setDialogProduct(null)
    setFormData({ ...productToFormData(product), isDefault: false })
    setDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    if (!isSaving) setDialogOpen(false)
  }, [isSaving])

  const setFormField = useCallback(
    (field: keyof BackofficeProductFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const setPaymentRuleField = useCallback(
    (
      cycle: BackofficeAdhesionBillingCycleKey,
      field: keyof BackofficeProductPaymentRuleFormEntry,
      value: string
    ) => {
      setFormData((prev) => ({
        ...prev,
        paymentRules: {
          ...prev.paymentRules,
          [cycle]: { ...prev.paymentRules[cycle], [field]: value },
        },
      }))
    },
    []
  )

  const submitForm = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (dialogMode === "create" || dialogMode === "duplicate") {
        const created = await pricingService.create(formData)
        setProducts((prev) => [...prev, created])
        toast.success("Produto criado com sucesso")
      } else if (dialogProduct) {
        const updated = await pricingService.update(dialogProduct.id, formData)
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        toast.success("Produto atualizado com sucesso")
      }
      setDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar produto"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [dialogMode, dialogProduct, formData, isSaving, pricingService])

  const openDeleteDialog = useCallback((product: BackofficeProductItem) => {
    setDeleteProduct(product)
    setDeleteDialogOpen(true)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) setDeleteDialogOpen(false)
  }, [isDeleting])

  const confirmDelete = useCallback(async () => {
    if (!deleteProduct || isDeleting) return
    setIsDeleting(true)
    try {
      await pricingService.delete(deleteProduct.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id))
      setDeleteDialogOpen(false)
      toast.success("Produto excluído com sucesso")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir produto"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }, [deleteProduct, isDeleting, pricingService])

  return (
    <BackofficePricingContext.Provider
      value={{
        products,
        availableFeatureSlugs,
        isLoading,
        canManage,
        dialogOpen,
        dialogMode,
        dialogProduct,
        formData,
        isSaving,
        openCreateDialog,
        openEditDialog,
        openDuplicateDialog,
        closeDialog,
        setFormField,
        setPaymentRuleField,
        submitForm,
        deleteDialogOpen,
        deleteProduct,
        isDeleting,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete,
      }}
    >
      {children}
    </BackofficePricingContext.Provider>
  )
}

export function useBackofficePricing(): PricingContextValue {
  const ctx = useContext(BackofficePricingContext)
  if (!ctx) throw new Error("useBackofficePricing must be used within BackofficePricingProvider")
  return ctx
}
