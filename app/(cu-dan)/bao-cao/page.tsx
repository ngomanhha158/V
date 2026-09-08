import { createClient } from '@/lib/db/server'
import { Hop, NhanNhom, PageHead, Trong } from '@/components/ui'
import { BaoCaoQuy, timQuyTruoc, type BanBaoCao } from '@/components/bao-cao-quy'
import { khuToiO } from '@/lib/khu-cu-dan'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()

  // MỌI khu người này ở, không phải khu đầu bảng. Chủ hộ có căn ở hai khu mà
  // chỉ đọc được báo cáo của một khu thì nửa còn lại coi như không tồn tại —
  // và không có màn nào báo cho họ biết là thiếu.
  const khu = await khuToiO()
  const theoKhu = await Promise.all(khu.map(async (k) => {
    const { data, error } = await db.rpc('bao_cao_quy_ds', { p_project: k.id })
    return {
      khu: k,
      rows: ((data ?? []) as BanBaoCao[]).filter((b) => !b.huy_luc),
      error,
    }
  }))
  // Chỉ ghi tên khu lên khối khi có TỪ HAI khu. Một khu mà vẫn dán nhãn thì đó
  // là một dòng chữ thừa trên mọi màn hình của mọi cư dân bình thường.
  const nhieuKhu = theoKhu.length > 1

  return (
    <div className="space-y-5">
      <PageHead
        title="Báo cáo quý"
        sub="Số liệu ban quản trị mang ra họp — cư dân đọc đúng bản đó"
      />

      {khu.length === 0 && (
        <Trong title="Tài khoản chưa gắn với căn hộ nào">
          Báo cáo quý đọc theo căn bạn đang ở, nên tài khoản chưa gắn căn thì
          không có gì để đọc. Nhờ ban quản lý gắn tài khoản vào căn của bạn.
        </Trong>
      )}

      {/* Mỗi khu một khối, kể cả khu chưa có báo cáo nào. Gộp hết vào một danh
          sách thì khu chưa lập báo cáo biến mất im lặng sau các bản của khu
          kia — cư dân tưởng đã xem hết, mà thật ra chưa thấy nửa nào. */}
      {theoKhu.map((t) => (
        <section key={t.khu.id} className="space-y-5">
          {nhieuKhu && (
            <NhanNhom>{t.khu.name}</NhanNhom>
          )}

          {t.error && (
            <Hop tone="xau" title="Không đọc được báo cáo">
              {t.error.code === '42883' || t.error.code === '42P01'
                ? 'Phần báo cáo quý chưa có trên database. Báo ban quản lý.'
                : t.error.message}
            </Hop>
          )}

          {/* So xu hướng trong PHẠM VI khu này. Quý trước của khu A phải là bản
              của khu A — bắt nhầm bản khu B thì mũi tên tăng/giảm là số bịa. */}
          {t.rows.map((b) => (
            <BaoCaoQuy key={b.id} b={b} truoc={timQuyTruoc(b, t.rows)} />
          ))}

          {!t.error && t.rows.length === 0 && (
            <Trong title="Chưa có báo cáo quý nào">
              Ban quản trị lập báo cáo sau khi mỗi quý kết thúc. Khi có, nó hiện ở đây.
            </Trong>
          )}
        </section>
      ))}

      <Hop tone="trung" title="Vì sao bạn đọc được báo cáo này">
        Đây là bộ số liệu ban quản trị mang ra họp. Giấu nó đi thì mỗi kỳ họp lại
        quay về cãi nhau về con số thay vì bàn về việc — nên nó công khai với cả
        khu, và nó đóng băng: số trong biên bản họp và số trên màn này là một.
      </Hop>
    </div>
  )
}
