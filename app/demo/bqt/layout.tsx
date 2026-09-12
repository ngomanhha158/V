import { DemoBanner } from '@/components/demo-banner'
import { BqtShell } from '@/components/shell/bqt-shell'
import { DU_AN } from '@/lib/demo/data'

export default function DemoBqtLayout({ children }: { children: React.ReactNode }) {
  return (
    <BqtShell base="/demo" khu={DU_AN.ten}>
      <DemoBanner />
      {children}
    </BqtShell>
  )
}
