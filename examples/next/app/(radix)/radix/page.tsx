import { PageView, type Search } from '@/ui/page-view'
import { radixThemes } from '@/ui/registries/radix-themes'

export default async function RadixPage({ searchParams }: { searchParams: Promise<Search> }) {
  return <PageView path="/radix" registry={radixThemes} searchParams={await searchParams} />
}
