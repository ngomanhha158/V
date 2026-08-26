import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImportForm } from './import-form'

export const dynamic = 'force-dynamic'

export default async function ImportUnits() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return <main><p>Chưa có dự án nào trong hệ thống.</p></main>
  }

  // Guard này chỉ để không hiện màn hình vô nghĩa cho cư dân. Chốt chặn thật là
  // RLS: policy unit_staff_write chặn insert dù có gọi thẳng API.
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: buildings } = await supabase.from('buildings').select('code').order('code')

  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-semibold">Import danh sách căn hộ</h1>
      <p className="text-sm opacity-70">{project.name}</p>
      <ImportForm buildingCodes={(buildings ?? []).map((b) => b.code)} />
    </main>
  )
}
