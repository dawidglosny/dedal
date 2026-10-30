import { PageView, type Search } from '@/ui/page-view'
import { shadcn } from '@/ui/registries/shadcn'

export default async function ShadcnPage({ searchParams }: { searchParams: Promise<Search> }) {
  return <PageView path="/shadcn" registry={shadcn} searchParams={await searchParams} />
}
