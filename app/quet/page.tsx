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
  // Như ở màn cư dân: hỏi "có phải nhân sự ở đâu đó không". Bảo vệ trực khu B
  // mà khu A lên trước thì màn quét thẻ đóng lại ngay giữa ca, và ở cửa thì
  // không có ai để hỏi vì sao.
  const { data: khuQuanLy } = await db.rpc('du_an_cua_toi')
  const dsKhu = (khuQuanLy ?? []) as { id: string; name: string }[]
  const laNhanSu = dsKhu.length > 0
  // Kể TÊN các khu quét được. Bảo vệ trực nhiều khu cần biết thẻ khu nào ra
  // kết quả đầy đủ — "dự án này" thì đúng khi có một khu và vô nghĩa khi có hai.
  const tenKhu = dsKhu.map((k) => k.name).join(', ')

  return (
    <BqlShell>
    <div className="space-y-5">
      <PageHead title="Quét mã ở cửa" sub="Thẻ cư dân và mã khách — dùng app camera có sẵn trên điện thoại" />

      {laNhanSu ? (
        <Hop tone="tot" title="Tài khoản này quét được">
          Bạn là nhân sự của {tenKhu}, nên thẻ của {dsKhu.length > 1 ? 'các khu đó' : 'khu đó'} quét
          ra đầy đủ họ tên và căn hộ.
        </Hop>
      ) : (
        <Hop tone="xau" title="Tài khoản này CHƯA quét được">
          Bạn chưa được gán vai trò nhân sự ở khu nào. Quét thẻ sẽ chỉ ra màn
          báo lỗi. Nhờ trưởng ban quản lý gán vai trò ở màn
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

      {/* Hai loại mã trông giống nhau trong máy camera nhưng xử lý khác nhau,
          và bảo vệ là người phải biết điều đó TRƯỚC khi vào ca. */}
      <Card>
        <CardHead title="Hai loại mã, hai màn khác nhau" />
        <div className="space-y-3 p-4 text-[0.875rem] leading-relaxed text-muted">
          <p>
            <strong className="text-ink">Thẻ cư dân</strong> — người đang sống ở
            đây. Mã sống một phút, quét xong là xong,{' '}
            <strong className="text-ink">không ghi vào sổ nào</strong>.
          </p>
          <p>
            <strong className="text-ink">Mã khách</strong> — người ngoài được cư
            dân mời. Màn quét hiện tên khách, căn được thăm và ai mời. Mở màn đó{' '}
            <strong className="text-ink">chưa ghi gì cả</strong>: soi thử thoải
            mái, chỉ khi bấm nút &ldquo;Ghi giờ VÀO&rdquo; mới vào sổ ra vào.
            Lúc khách về, quét lại chính mã đó để ghi giờ ra.
          </p>
        </div>
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
