import { DemoBanner } from '@/components/demo-banner'
import { BqlShell } from '@/components/shell/bql-shell'
import { Card, CardHead, Hop, PageHead } from '@/components/ui'
import { LY_DO_THE, vaiCan } from '@/lib/vai-tro'

// Bày CẢ HAI kết quả cạnh nhau. Màn thật chỉ hiện một cái mỗi lần quét, nhưng
// điều đáng xem của tính năng này nằm ở chỗ đối lập: thẻ hỏng thì màn đỏ vẫn
// nói ra danh tính và LÝ DO, chứ không đóng sập lại. Dùng chung vaiCan và
// LY_DO_THE với màn thật — lệch chữ là bản demo dạy sai người trực cửa.
const MAU = [
  {
    ok: true, ho_ten: 'Ngô Mạnh Hà', can: 'P1-10.01', toa: 'Park 1',
    vai_tro: 'owner', ly_do: 'ok',
  },
  {
    ok: false, ho_ten: 'Lê Thị Hoài', can: 'P2-08.05', toa: 'Park 2',
    vai_tro: 'tenant', ly_do: 'het_han',
  },
]

export default function Page() {
  return (
    <BqlShell base="/demo" duAn="Sunrise Riverside">
    <DemoBanner />
    <div className="space-y-5">
      <PageHead title="Quét thẻ cư dân" sub="Dùng app camera có sẵn trên điện thoại" />

      <Hop tone="tot" title="Tài khoản này quét được">
        Bạn là nhân sự của Sunrise Riverside, nên kết quả quét sẽ hiện đầy đủ họ
        tên và căn hộ.
      </Hop>

      <Card>
        <CardHead title="Ba bước" />
        <ol className="space-y-3 p-4 text-[0.875rem] leading-relaxed text-muted">
          <li><strong className="text-ink">1. Cư dân mở màn Thẻ cư dân</strong> và đưa màn hình cho bạn.</li>
          <li><strong className="text-ink">2. Mở app Camera</strong> và hướng vào mã. Không cần cài gì thêm.</li>
          <li><strong className="text-ink">3. Bấm vào link hiện lên.</strong> Xanh là hợp lệ, đỏ là không.</li>
        </ol>
      </Card>

      {MAU.map((m) => (
        <Card key={m.can}>
          <CardHead title={m.ok ? 'Hợp lệ — mời vào' : 'Không hợp lệ'} />
          <div
            className={`flex items-center gap-4 border-t-4 p-4 ${
              m.ok ? 'border-ok bg-ok-soft' : 'border-bad bg-bad-soft'
            }`}
          >
            <span className="grid size-20 shrink-0 place-items-center rounded-full border border-dashed border-line-firm text-center text-[0.6875rem] leading-tight text-faint">
              Chưa có ảnh
            </span>
            <div className="min-w-0">
              <p className="text-[1.0625rem] font-semibold text-ink">{m.ho_ten}</p>
              <p className="num text-[0.9375rem] font-medium text-muted">{m.can}</p>
              <p className="text-[0.8125rem] text-faint">{m.toa} · {vaiCan(m.vai_tro)}</p>
            </div>
          </div>
          {!m.ok && (
            <div className="border-t border-line p-4">
              <Hop tone="xau" title="Vì sao không vào được">{LY_DO_THE[m.ly_do]}</Hop>
            </div>
          )}
        </Card>
      ))}

      <Hop tone="trung" title="Hai điều cần nhớ">
        Mã của cư dân chỉ sống một phút, nên quét ra &ldquo;mã đã hết hạn&rdquo;
        thì không phải họ gian — nhờ họ mở lại màn thẻ là xong.
        <br /><br />
        Và mã hợp lệ chỉ chứng minh <strong>chiếc điện thoại đó</strong> đang giữ
        thẻ của căn hộ đó. Nhìn mặt người đứng trước bạn có khớp ảnh trên màn
        không — đó là bước duy nhất hệ thống không làm thay được.
      </Hop>
    </div>
    </BqlShell>
  )
}
