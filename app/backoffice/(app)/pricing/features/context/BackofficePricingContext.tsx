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
  InstallmentGroup,
  InstallmentSplitMode,
} from "./BackofficePricingTypes"
import { BILLING_CYCLE_META, EMPTY_PRODUCT_FORM, groupSchedule, isCycleRuleConfigured } from "./BackofficePricingTypes"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

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
  toggleFeatureSlug: (slug: string) => void
  setFormField: (field: keyof BackofficeProductFormData, value: string | boolean | string[]) => void
  setPaymentRuleField: (
    cycle: BackofficeAdhesionBillingCycleKey,
    field: keyof BackofficeProductPaymentRuleFormEntry,
    value: string
  ) => void
  setInstallmentSplitMode: (cycle: BackofficeAdhesionBillingCycleKey, mode: InstallmentSplitMode) => void
  setInstallmentGroup: (cycle: BackofficeAdhesionBillingCycleKey, index: number, field: keyof InstallmentGroup, value: string) => void
  addInstallmentGroup: (cycle: BackofficeAdhesionBillingCycleKey) => void
  removeInstallmentGroup: (cycle: BackofficeAdhesionBillingCycleKey, index: number) => void
  addActiveCycle: (cycle: BackofficeAdhesionBillingCycleKey) => void
  removeActiveCycle: (cycle: BackofficeAdhesionBillingCycleKey) => void
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
    const splitMode = card?.installmentSplitMode ?? "EQUAL"
    return {
      pixPrice: pix ? String(pix.price) : "",
      cardPrice: card ? String(card.price) : "",
      maxInstallments: card ? String(card.maxInstallments) : defaultMax,
      installmentSplitMode: splitMode,
      installmentSchedule: splitMode === "CUSTOM" ? groupSchedule(card?.installmentSchedule ?? []) : [{ count: "1", value: "" }],
    }
  }

  const paymentRules = {
    monthly: ruleEntry("monthly", "1"),
    quarterly: ruleEntry("quarterly", "3"),
    quadrimester: ruleEntry("quadrimester", "4"),
    semiannual: ruleEntry("semiannual", "6"),
    annual: ruleEntry("annual", "12"),
  }
  const cyclesFromRules = Array.from(
    new Set(product.paymentRules.map((rule) => rule.billingCycle as BackofficeAdhesionBillingCycleKey))
  )
  const activeCycles =
    cyclesFromRules.length > 0
      ? BILLING_CYCLE_META.map((meta) => meta.key).filter((key) => cyclesFromRules.includes(key))
      : BILLING_CYCLE_META.map((meta) => meta.key).filter((key) => isCycleRuleConfigured(paymentRules[key]))

  return {
    name: product.name,
    featureSlugs: product.featureSlugs,
    description: product.description ?? "",
    type: product.type,
    billingMode: product.billingMode,
    priceMonthly: product.priceMonthly != null ? String(product.priceMonthly) : "",
    priceQuarterly: product.priceQuarterly != null ? String(product.priceQuarterly) : "",
    priceQuadrimester: product.priceQuadrimester != null ? String(product.priceQuadrimester) : "",
    priceSemiannual: product.priceSemiannual != null ? String(product.priceSemiannual) : "",
    priceAnnual: product.priceAnnual != null ? String(product.priceAnnual) : "",
    priceLifetime: product.priceLifetime != null ? String(product.priceLifetime) : "",
    isDefault: product.isDefault,
    isActive: product.isActive,
    activeCycles,
    paymentRules,
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
    (field: keyof BackofficeProductFormData, value: string | boolean | string[]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const toggleFeatureSlug = useCallback((slug: string) => {
    setFormData((prev) => {
      const has = prev.featureSlugs.includes(slug)
      const featureSlugs = has
        ? prev.featureSlugs.filter((item) => item !== slug)
        : [...prev.featureSlugs, slug]
      return { ...prev, featureSlugs }
    })
  }, [])

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

  const setInstallmentSplitMode = useCallback(
    (cycle: BackofficeAdhesionBillingCycleKey, mode: InstallmentSplitMode) => {
      setFormData((prev) => ({
        ...prev,
        paymentRules: {
          ...prev.paymentRules,
          [cycle]: {
            ...prev.paymentRules[cycle],
            installmentSplitMode: mode,
            installmentSchedule: mode === "CUSTOM" ? [{ count: "1", value: "" }] : prev.paymentRules[cycle].installmentSchedule,
          },
        },
      }))
    },
    []
  )

  const setInstallmentGroup = useCallback(
    (cycle: BackofficeAdhesionBillingCycleKey, index: number, field: keyof InstallmentGroup, value: string) => {
      setFormData((prev) => {
        const groups = [...prev.paymentRules[cycle].installmentSchedule]
        groups[index] = { ...groups[index], [field]: value }
        return {
          ...prev,
          paymentRules: {
            ...prev.paymentRules,
            [cycle]: { ...prev.paymentRules[cycle], installmentSchedule: groups },
          },
        }
      })
    },
    []
  )

  const addInstallmentGroup = useCallback(
    (cycle: BackofficeAdhesionBillingCycleKey) => {
      setFormData((prev) => ({
        ...prev,
        paymentRules: {
          ...prev.paymentRules,
          [cycle]: {
            ...prev.paymentRules[cycle],
            installmentSchedule: [...prev.paymentRules[cycle].installmentSchedule, { count: "1", value: "" }],
          },
        },
      }))
    },
    []
  )

  const removeInstallmentGroup = useCallback(
    (cycle: BackofficeAdhesionBillingCycleKey, index: number) => {
      setFormData((prev) => {
        const groups = prev.paymentRules[cycle].installmentSchedule.filter((_, i) => i !== index)
        return {
          ...prev,
          paymentRules: {
            ...prev.paymentRules,
            [cycle]: {
              ...prev.paymentRules[cycle],
              installmentSchedule: groups.length ? groups : [{ count: "1", value: "" }],
            },
          },
        }
      })
    },
    []
  )

  const addActiveCycle = useCallback((cycle: BackofficeAdhesionBillingCycleKey) => {
    setFormData((prev) => {
      if (prev.activeCycles.includes(cycle)) return prev
      return { ...prev, activeCycles: [...prev.activeCycles, cycle] }
    })
  }, [])

  const removeActiveCycle = useCallback((cycle: BackofficeAdhesionBillingCycleKey) => {
    const meta = BILLING_CYCLE_META.find((item) => item.key === cycle)
    setFormData((prev) => ({
      ...prev,
      activeCycles: prev.activeCycles.filter((key) => key !== cycle),
      paymentRules: {
        ...prev.paymentRules,
        [cycle]: {
          pixPrice: "",
          cardPrice: "",
          maxInstallments: String(meta?.defaultMax ?? 1),
          installmentSplitMode: "EQUAL" as const,
          installmentSchedule: [{ count: "1", value: "" }],
        },
      },
    }))
  }, [])

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
      const message = toUserToastMessage(err)
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
      const message = toUserToastMessage(err)
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
        toggleFeatureSlug,
        setPaymentRuleField,
        setInstallmentSplitMode,
        setInstallmentGroup,
        addInstallmentGroup,
        removeInstallmentGroup,
        addActiveCycle,
        removeActiveCycle,
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
