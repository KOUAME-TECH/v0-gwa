import { ShopHero } from "@/components/catalog/shop-hero"
import { getShopHero } from "@/lib/catalog/shop-hero"
import MarketplaceClient from "./marketplace-client"

export const revalidate = 60

export default async function MarketplacePage() {
  const hero = await getShopHero()
  return (
    <>
      {hero ? <ShopHero product={hero} /> : null}
      <MarketplaceClient hasServerHero={Boolean(hero)} />
    </>
  )
}
