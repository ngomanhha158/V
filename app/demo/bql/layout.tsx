import { DemoBanner } from '@/components/demo-banner'
import { BqlShell } from '@/components/shell/bql-shell'
import { KHU_DEMO } from '@/lib/demo/data'
import { khuDemoDangXem } from './khu-dang-xem'
import { chonKhuDemo } from './chon-khu'

export default async function DemoBqlLayout({ children }: { children: React.ReactNode }) {
  const dang = await khuDemoDangXem()
  return (
    <BqlShell base="/demo" duAn={dang.name} khu={dang} dsKhu={KHU_DEMO} chonKhu={chonKhuDemo}>
      <DemoBanner />
      {children}
    </BqlShell>
  )
}
