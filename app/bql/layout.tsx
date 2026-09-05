import { BqlShell } from '@/components/shell/bql-shell'
import { khuDangXem } from '@/lib/du-an'
import { chonKhu } from './chon-khu'

export default async function BqlLayout({ children }: { children: React.ReactNode }) {
  const { dang, ds } = await khuDangXem()
  return (
    <BqlShell duAn={dang?.name} khu={dang} dsKhu={ds} chonKhu={chonKhu}>
      {children}
    </BqlShell>
  )
}
