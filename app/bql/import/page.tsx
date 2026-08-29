import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImportForm } from './import-form'
import { PageHead, Trong } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ImportUnits() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return <Trong title="Chưa có dự án nào trong hệ thống" />
  }

  // Guard này chỉ để không hiện màn hình vô nghĩa cho cư dân. Chốt chặn thật là
  // RLS: policy unit_staff_write chặn insert dù có gọi thẳng API.
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: buildings } = await supabase.from('buildings').select('code').order('code')

  return (
    <div className="space-y-5">
      <PageHead
        title="Import danh sách căn hộ"
        sub={`${project.name} · đọc file Excel, kiểm tra trước khi ghi`}
      />
      <ImportForm buildingCodes={(buildings ?? []).map((b) => b.code)} />
    </div>
  )
}
