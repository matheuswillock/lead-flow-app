export function productHasFeatureSlug(
  product: { featureSlugs: string[] },
  slug: string
): boolean {
  return product.featureSlugs.includes(slug)
}

export function expandProductFeatureSlugs(product: { featureSlugs: string[] }): string[] {
  return [...product.featureSlugs]
}

export function addProductFeatureSlugsToSet(
  target: Set<string>,
  product: { featureSlugs: string[] }
): void {
  for (const slug of product.featureSlugs) {
    target.add(slug)
  }
}
