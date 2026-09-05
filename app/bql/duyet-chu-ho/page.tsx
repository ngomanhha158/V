import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { Card, CardHead, Hop, PageHead, Pill, Trong } from '@/components/ui'
import { HangCho, type YeuCau } from './hang-cho'

export const dynamic = 'force-dynamic'

export default async function DuyetChuHo() {
  const db = await createClient()
  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: rows, error } = await db.rpc('bql_cho_duyet_chu_ho', {
    p_project: project.id,
  })

  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Duyệt chủ hộ đầu tiên" />
        <Hop tone="xau" title="Không tải được danh sách">{error.message}</Hop>
      </div>
    )
  }

  const ds = (rows ?? []) as YeuCau[]

  return (
    <div className="space-y-5">
      <PageHead
        title="Duyệt chủ hộ đầu tiên"
        sub={`${project.name} · chỉ những căn CHƯA có chủ hộ nào`}
        actions={
          ds.length
            ? <Pill tone="canh">{ds.length} yêu cầu chờ</Pill>
            : <Pill tone="tot">Không còn tồn đọng</Pill>
        }
      />

      <Hop tone="trung" title="Vì sao việc này thuộc về BQL">
        Duyệt thành viên căn hộ vốn là việc của chủ hộ. Nhưng chủ hộ ĐẦU TIÊN của một
        căn thì không ai duyệt được — muốn duyệt phải đã là chủ hộ, mà muốn thành chủ
        hộ thì phải được duyệt. BQL cắt vòng đó đúng một lần cho mỗi căn, vì BQL có hợp
        đồng mua bán và biên bản bàn giao trong tay để đối chiếu danh tính.
        <br /><br />
        Duyệt xong là cửa này đóng lại với căn đó: người thuê, thành viên gia đình,
        người được ủy quyền — tất cả do chính chủ hộ duyệt. BQL không tự thêm mình vào
        căn của ai được.
      </Hop>

      <Card>
        <CardHead
          title="Đang chờ"
          sub="Đối chiếu tên và số điện thoại với hợp đồng trước khi bấm duyệt"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có yêu cầu nào chờ duyệt">
              Cư dân quét mã QR ở sảnh, đăng nhập rồi xin gia nhập căn của mình thì yêu
              cầu sẽ hiện ở đây.
            </Trong>
          </div>
        ) : (
          <HangCho ds={ds} />
        )}
      </Card>
    </div>
  )
}
