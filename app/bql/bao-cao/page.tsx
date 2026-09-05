import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { Hop, PageHead, Trong, Card, CardHead } from '@/components/ui'
import { BaoCaoQuy, timQuyTruoc, type BanBaoCao } from '@/components/bao-cao-quy'
import { FormLap, NutHuy } from './form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const project = await duAnBQL()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Báo cáo quý" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const { data: ds, error } = await db.rpc('bao_cao_quy_ds', { p_project: project.id })
  const rows = (ds ?? []) as BanBaoCao[]

  return (
    <div className="space-y-5">
      <PageHead
        title="Báo cáo quý"
        sub="Bản chụp đóng băng để biên bản họp và báo cáo nói cùng một con số mãi mãi"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần báo cáo quý chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      <Card>
        <CardHead
          title="Lập báo cáo"
          sub="Job nền tự sinh vào 02:00 ngày 5 tháng đầu mỗi quý — nút này để lập sớm hoặc lập lại"
        />
        <div className="p-4"><FormLap project={project.id} /></div>
      </Card>

      {rows.map((b) => (
        <BaoCaoQuy
          key={b.id}
          b={b}
          truoc={timQuyTruoc(b, rows)}
          hanhDong={!b.huy_luc ? (
            <div className="border-t border-line pt-4"><NutHuy id={b.id} /></div>
          ) : null}
        />
      ))}

      {!error && rows.length === 0 && (
        <Trong title="Chưa có báo cáo quý nào">
          Lập bản đầu tiên ở khối trên, hoặc chờ job nền sinh vào ngày 5 tháng đầu
          quý sau.
        </Trong>
      )}

      <Hop tone="trung" title="Vì sao báo cáo phải đóng băng">
        BQT họp quý, bàn dựa trên số liệu, rồi biên bản ghi lại con số đó. Nếu mở
        lại báo cáo sau ba tháng mà thấy số khác — vì tiền về muộn, vì có yêu cầu
        đóng thêm — thì biên bản đã ký thành sai, và không ai sửa được. Nên ở đây
        mỗi quý có đúng một bản còn hiệu lực, số chốt lúc lập, và muốn số mới thì
        phải hủy bản cũ kèm lý do.
      </Hop>
    </div>
  )
}
