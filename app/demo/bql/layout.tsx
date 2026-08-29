import { DemoBanner } from '@/components/demo-banner'
import { BqlShell } from '@/components/shell/bql-shell'

export default function DemoBqlLayout({ children }: { children: React.ReactNode }) {
  return (
    <BqlShell base="/demo" duAn="Sunrise Riverside">
      <DemoBanner />
      {children}
    </BqlShell>
  )
}
