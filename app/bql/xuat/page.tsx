import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { BAO_CAO, docKy, kyHienTai } from '@/lib/xuat/bao-cao'
import { Card, CardHead, Hop, PageHead, Trong } from '@/components/ui'
import { ChonKy, TheBaoCao } from './form'

export const dynamic = 'force-dynamic'

export default async function Xuat({
  searchParams,
}: { searchParams: Promise<{ ky?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào trong hệ thống" />

  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const ky = docKy(sp.ky) ?? kyHienTai()

  // Đếm sẵn xem kỳ này có gì: bấm tải rồi mới biết file rỗng thì mất công, mà
  // "file rỗng" với "hệ thống hỏng" nhìn từ ngoài giống hệt nhau.
  const [hoaDon, giaoDich, congNo] = await Promise.all([
    supabase.from('invoices').select('id', { count: 'exact', head: true })
      .eq('project_id', project.id).eq('period', `${ky}-01`),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true })
      .eq('project_id', project.id),
    supabase.rpc('bql_debt_report', { p_project: project.id }),
  ])

  const soDong: Record<string, number | null> = {
    'cong-no': congNo.error ? null : (congNo.data ?? []).length,
    'hoa-don': hoaDon.count ?? 0,
    'so-quy': null,      // đếm được nhưng tốn một truy vấn join; để trang xuất tự nói
    'doi-soat': giaoDich.count ?? 0,
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Xuất Excel"
        sub={`${project.name} · file .xlsx mở được bằng Excel, Google Sheets hay LibreOffice`}
      />

      <Hop tone="trung" title="Số tiền trong file là SỐ, không phải chữ">
        Cột tiền ghi ở dạng số có định dạng phân nhóm nghìn, nên bôi đen cả cột là Excel
        cộng ra tổng ngay. Ghi thành chữ &ldquo;1.287.000đ&rdquo; thì nhìn đẹp hơn nhưng
        không cộng được — mà cộng được mới là lý do cần file Excel thay vì ảnh chụp màn hình.
        <br /><br />
        Mỗi file có sheet <strong>Tổng hợp</strong> đứng trước, ghi rõ kỳ, thời điểm chốt số
        và người xuất. Báo cáo công nợ hôm nay khác hôm qua và cả hai đều đúng — không ghi
        mốc vào file thì hai người cầm hai bản sẽ cãi nhau xem bản nào sai.
      </Hop>

      <Card>
        <CardHead title="Kỳ" sub="Áp cho ba báo cáo theo kỳ; công nợ luôn là ảnh chụp lúc bấm tải" />
        <ChonKy ky={ky} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {BAO_CAO.map((bc) => (
          <TheBaoCao key={bc.id} bc={bc} ky={ky} soDong={soDong[bc.id]} />
        ))}
      </div>
    </div>
  )
}
