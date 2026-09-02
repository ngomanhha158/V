import { tenChuKy, tenHangMuc, theoHan, tinhTrangHan } from '@/lib/bao-tri'
import {
  Card, CardHead, Hop, ngayVN, PageHead, Pill, Stat, Trong,
} from '@/components/ui'
import { BAO_TRI, DU_AN, VIEC_BAO_TRI } from '@/lib/demo/data'
import { XongDemo } from './xong-demo'

export const dynamic = 'force-dynamic'

// Dùng chung tinhTrangHan, tenHangMuc, tenChuKy với màn thật — thang màu của
// cái hạn mà lệch nhau giữa hai màn là bản demo dạy sai về mức độ khẩn.

export default async function DemoBaoTri() {
  const ds = [...BAO_TRI].sort(theoHan)
  const bat = ds.filter((k) => k.is_active)
  const theoKe = new Map(BAO_TRI.map((k) => [k.id, k]))

  const quaHan = bat.filter(
    (k) => tinhTrangHan(k.han_ke_tiep, k.nhac_truoc_ngay, k.bat_buoc_phap_ly).muc === 'qua_han')
  const theoLuat = bat.filter((k) => k.bat_buoc_phap_ly)
  const luatQuaHan = quaHan.filter((k) => k.bat_buoc_phap_ly)

  return (
    <div className="space-y-5">
      <PageHead
        title="Bảo trì định kỳ"
        sub={`${DU_AN.ten} · ${bat.length} hạng mục đang theo dõi`}
        actions={quaHan.length
          ? <Pill tone="xau">{quaHan.length} hạng mục quá hạn</Pill>
          : <Pill tone="tot">Không có hạng mục nào quá hạn</Pill>}
      />

      {luatQuaHan.length > 0 && (
        <Hop tone="xau" title={`${luatQuaHan.length} hạng mục BẮT BUỘC THEO LUẬT đang quá hạn`}>
          {luatQuaHan.map((k) => k.ten).join(' · ')}.
          <br /><br />
          Quá hạn kiểm định không chỉ là chậm việc: bị phạt là chuyện nhẹ hơn, chuyện nặng
          là thang máy hay hệ PCCC chạy ngoài hạn kiểm định khi có sự cố.
        </Hop>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat nhan="Đang theo dõi" so={bat.length} />
        <Stat nhan="Bắt buộc theo luật" so={theoLuat.length} tone="brand" />
        <Stat nhan="Quá hạn" so={quaHan.length} tone={quaHan.length ? 'xau' : 'tot'} />
        <Stat nhan="Việc đang mở" so={VIEC_BAO_TRI.length} phu="chờ đánh dấu đã làm" />
      </div>

      <Hop tone="trung" title="Việc tự mở, nhưng không tự đóng">
        Mỗi đêm hệ thống mở một lần bảo trì cho hạng mục đã tới cửa sổ nhắc. Đóng là việc của
        người làm — và lúc đóng, <strong>hạn kế tiếp tính từ ngày làm thật</strong> cộng chu
        kỳ, không phải từ hạn cũ. Giấy kiểm định có hiệu lực từ ngày kiểm chứ không từ ngày
        lẽ ra phải kiểm.
      </Hop>

      <Card>
        <CardHead
          title="Việc đang mở"
          sub="Đã tới cửa sổ nhắc, chưa ai đánh dấu làm xong"
          right={<span className="text-[0.8125rem] text-faint">{VIEC_BAO_TRI.length}</span>}
        />
        <ul className="divide-y divide-line">
          {VIEC_BAO_TRI.map((v) => {
            const kh = theoKe.get(v.plan_id)
            if (!kh) return null
            const t = tinhTrangHan(v.han, kh.nhac_truoc_ngay, kh.bat_buoc_phap_ly)
            return (
              <li key={v.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{kh.ten}</span>
                      {kh.bat_buoc_phap_ly && <Pill tone="brand" cham={false}>Theo luật</Pill>}
                    </div>
                    <div className="mt-0.5 text-[0.8125rem] text-muted">Hạn {ngayVN(v.han)}</div>
                  </div>
                  <Pill tone={t.tone}>{t.nhan}</Pill>
                </div>
                <XongDemo ten={kh.ten} chuKy={kh.chu_ky_ngay} />
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <CardHead
          title="Lịch bảo trì"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        <ul className="divide-y divide-line">
          {ds.map((kh) => {
            const t = tinhTrangHan(kh.han_ke_tiep, kh.nhac_truoc_ngay, kh.bat_buoc_phap_ly)
            return (
              <li key={kh.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{kh.ten}</span>
                    {kh.bat_buoc_phap_ly && <Pill tone="brand" cham={false}>Theo luật</Pill>}
                    {!kh.is_active && <Pill tone="trung">Tạm dừng</Pill>}
                  </div>
                  <div className="mt-1 text-[0.8125rem] text-muted">
                    {tenHangMuc(kh.hang_muc)} · {tenChuKy(kh.chu_ky_ngay)} ·
                    {' '}hạn {ngayVN(kh.han_ke_tiep)}
                    {kh.nha_thau && ` · ${kh.nha_thau}`}
                  </div>
                </div>
                {kh.is_active && <Pill tone={t.tone}>{t.nhan}</Pill>}
              </li>
            )
          })}
        </ul>
      </Card>

      <Hop tone="canh" title="Vì sao hai hạng mục còn xa vẫn không màu xanh">
        &ldquo;Chạy thử máy phát điện&rdquo; còn 58 ngày mà vẫn vàng, trong khi &ldquo;Vệ sinh
        bể nước&rdquo; còn 41 ngày lại xanh. Không phải lỗi: hạng mục{' '}
        <strong>bắt buộc theo luật</strong> không bao giờ xuống xanh. Để chúng cùng màu với
        việc vệ sinh là làm hai loại rủi ro rất khác nhau trông giống nhau — mà cái nặng hơn
        lại là cái dễ trôi qua.
      </Hop>

      <Trong title="Bản demo không ghi vào database">
        Nút &ldquo;Đánh dấu đã làm&rdquo; ở trên tính và hiện đúng hạn kế tiếp như màn thật,
        nhưng không lưu gì.
      </Trong>
    </div>
  )
}
