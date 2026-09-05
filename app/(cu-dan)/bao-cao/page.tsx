import { createClient } from '@/lib/db/server'
import { Hop, PageHead, Trong } from '@/components/ui'
import { BaoCaoQuy, timQuyTruoc, type BanBaoCao } from '@/components/bao-cao-quy'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id').limit(1).maybeSingle()
  const { data: ds, error } = project
    ? await db.rpc('bao_cao_quy_ds', { p_project: project.id })
    : { data: [], error: null }
  const rows = ((ds ?? []) as BanBaoCao[]).filter((b) => !b.huy_luc)

  return (
    <div className="space-y-5">
      <PageHead
        title="Báo cáo quý"
        sub="Số liệu ban quản trị mang ra họp — cư dân đọc đúng bản đó"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được báo cáo">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần báo cáo quý chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {rows.map((b) => (
        <BaoCaoQuy key={b.id} b={b} truoc={timQuyTruoc(b, rows)} />
      ))}

      {!error && rows.length === 0 && (
        <Trong title="Chưa có báo cáo quý nào">
          Ban quản trị lập báo cáo sau khi mỗi quý kết thúc. Khi có, nó hiện ở đây.
        </Trong>
      )}

      <Hop tone="trung" title="Vì sao bạn đọc được báo cáo này">
        Đây là bộ số liệu ban quản trị mang ra họp. Giấu nó đi thì mỗi kỳ họp lại
        quay về cãi nhau về con số thay vì bàn về việc — nên nó công khai với cả
        khu, và nó đóng băng: số trong biên bản họp và số trên màn này là một.
      </Hop>
    </div>
  )
}
