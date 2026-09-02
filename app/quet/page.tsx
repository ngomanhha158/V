import { createClient } from '@/lib/db/server'
import { BqlShell } from '@/components/shell/bql-shell'
import { Card, CardHead, Hop, PageHead } from '@/components/ui'

/**
 * Màn hướng dẫn quét, không phải màn quét.
 *
 * Cố ý KHÔNG dựng máy quét trong app. Trình duyệt trên iOS không có
 * BarcodeDetector, nên muốn quét trong app thì phải kéo một thư viện giải mã
 * QR về — vài trăm KB nằm trong bundle của mọi người, để phục vụ đúng vài bảo
 * vệ. App camera có sẵn trên máy làm việc đó tốt hơn, không cần cài gì, và
 * chạy được cả trên chiếc điện thoại cũ nhất trong ca trực.
 *
 * Giá trị của trang này nằm ở chỗ khác: nói cho bảo vệ biết TÀI KHOẢN NÀY có
 * quét được không, ngay bây giờ, chứ không để họ phát hiện ra ở cửa với hàng
 * người đang chờ.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  const { data: laNhanSu } = project
    ? await db.rpc('is_staff', { p_project: project.id })
    : { data: false }

  return (
    <BqlShell>
    <div className="space-y-5">
      <PageHead title="Quét thẻ cư dân" sub="Dùng app camera có sẵn trên điện thoại" />

      {laNhanSu ? (
        <Hop tone="tot" title="Tài khoản này quét được">
          Bạn là nhân sự của {project?.name ?? 'dự án này'}, nên kết quả quét sẽ
          hiện đầy đủ họ tên và căn hộ.
        </Hop>
      ) : (
        <Hop tone="xau" title="Tài khoản này CHƯA quét được">
          Bạn chưa được gán vai trò nhân sự của {project?.name ?? 'dự án'}. Quét
          thẻ sẽ chỉ ra màn báo lỗi. Nhờ trưởng ban quản lý gán vai trò ở màn
          Người dùng, rồi đăng nhập lại — <strong>làm trước khi vào ca</strong>,
          đừng để phát hiện ra lúc đang có người đứng chờ ở cửa.
        </Hop>
      )}

      <Card>
        <CardHead title="Ba bước" />
        <ol className="space-y-3 p-4 text-[0.875rem] leading-relaxed text-muted">
          <li>
            <strong className="text-ink">1. Cư dân mở màn Thẻ cư dân</strong> trên
            máy của họ và đưa màn hình cho bạn.
          </li>
          <li>
            <strong className="text-ink">2. Mở app Camera</strong> trên máy bạn và
            hướng vào mã. Không cần cài gì thêm; một đường link sẽ hiện lên.
          </li>
          <li>
            <strong className="text-ink">3. Bấm vào link đó.</strong> Màn xanh là
            hợp lệ, màn đỏ là không — và màn đỏ luôn nói rõ vì sao.
          </li>
        </ol>
      </Card>

      <Hop tone="trung" title="Hai điều cần nhớ">
        Mã của cư dân chỉ sống một phút, nên nếu quét ra &ldquo;mã đã hết
        hạn&rdquo; thì không phải họ gian — nhờ họ mở lại màn thẻ là xong.
        <br /><br />
        Và mã hợp lệ chỉ chứng minh <strong>chiếc điện thoại đó</strong> đang giữ
        thẻ của căn hộ đó. Nhìn mặt người đứng trước bạn có khớp ảnh trên màn
        không — đó là bước duy nhất hệ thống không làm thay được.
      </Hop>
    </div>
    </BqlShell>
  )
}
