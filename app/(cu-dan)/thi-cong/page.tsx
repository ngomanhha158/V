import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, ngayGioVN } from '@/components/ui'
import {
  NHAN_LOAI, NHAN_TRANG_THAI, TONE_TRANG_THAI,
  changKyQuy, loiKhoangNgay, loiKhungGio,
} from '@/lib/thi-cong'
import { FormDangKy, NutHuyDon } from './form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const [{ data: ds, error }, { data: me }] = await Promise.all([
    db.rpc('thi_cong_cua_toi'),
    db.auth.getUser(),
  ])
  const { data: can } = await db
    .from('unit_memberships')
    .select('units!inner(id, code)')
    .eq('user_id', me.user?.id ?? '')
    .eq('status', 'active')
    .in('role', ['owner', 'authorized', 'tenant'])

  const rows = ds ?? []
  const cuaToi = (can ?? [])
    .map((m) => (m as unknown as { units: { id: string; code: string } }).units)
    .filter(Boolean)

  return (
    <div className="space-y-5">
      <PageHead
        title="Chuyển nhà & sửa chữa"
        sub="Đăng ký trước, nộp ký quỹ, rồi thi công trong khung giờ được duyệt"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần đăng ký thi công chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {rows.map((d) => {
        const kq = changKyQuy(d)
        const dangHieuLuc = d.trang_thai === 'da_duyet'
        return (
          <Card key={d.id}>
            <CardHead
              xuongDong
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words">{d.hang_muc}</span>
                  <Pill tone={TONE_TRANG_THAI[d.trang_thai as keyof typeof TONE_TRANG_THAI] ?? 'trung'}>
                    {NHAN_TRANG_THAI[d.trang_thai as keyof typeof NHAN_TRANG_THAI] ?? d.trang_thai}
                  </Pill>
                </span>
              }
              sub={
                `Căn ${d.ma_can} · ${NHAN_LOAI[d.loai as keyof typeof NHAN_LOAI] ?? d.loai} · `
                + `${loiKhoangNgay(d.tu_ngay, d.den_ngay)}`
              }
            />
            <div className="space-y-3 p-4">
              {d.trang_thai === 'tu_choi' && (
                <Hop tone="xau" title="Ban quản lý từ chối">
                  {d.ly_do_tu_choi || 'Không ghi lý do'}. Sửa lại rồi nộp đơn mới được.
                </Hop>
              )}

              {dangHieuLuc && (
                <Hop tone={d.duoc_luc_nay ? 'tot' : 'canh'} title={d.duoc_luc_nay ? 'Đang được thi công' : 'Lúc này chưa được'}>
                  {d.ly_do_luc_nay}
                  {' '}Khung giờ được duyệt:{' '}
                  <span className="num">{loiKhungGio(d.gio_bat_dau, d.gio_ket_thuc, d.lam_chu_nhat)}</span>.
                </Hop>
              )}

              <Hop tone={kq.buoc === 'chua_nop' ? 'canh' : 'trung'} title="Ký quỹ">
                {kq.loi}
              </Hop>

              <div className="num text-[0.75rem] text-faint">
                Đăng ký lúc {ngayGioVN(d.dang_ky_luc)}
              </div>

              {['cho_duyet', 'da_duyet'].includes(d.trang_thai) && d.ky_quy_da_nop === 0 && (
                <NutHuyDon id={d.id} />
              )}
            </div>
          </Card>
        )
      })}

      {!error && rows.length === 0 && (
        <Trong title="Bạn chưa có đăng ký nào">
          Sắp chuyển vào, chuyển ra hay sửa nhà thì đăng ký ở khối bên dưới.
        </Trong>
      )}

      {cuaToi.length > 0 ? (
        <Card>
          <CardHead title="Đăng ký mới" sub="Ban quản lý duyệt và ấn định mức ký quỹ" />
          <div className="p-4"><FormDangKy can={cuaToi} /></div>
        </Card>
      ) : (
        <Hop tone="canh" title="Bạn chưa gắn với căn hộ nào">
          Chỉ chủ sở hữu, người được ủy quyền hoặc người thuê mới đăng ký được —
          đây là một cam kết có tiền ký quỹ đi kèm.
        </Hop>
      )}

      <Hop tone="trung" title="Vì sao phải ký quỹ">
        Thi công làm xước sàn thang máy hay vỡ kính sảnh là chuyện xảy ra thật, và
        nếu không có ký quỹ thì tiền sửa lấy từ quỹ bảo trì — tức là cả tòa trả cho
        một nhà. Ký quỹ hoàn lại đủ nếu không hỏng gì; trừ thì ban quản lý phải ghi
        rõ lý do, và con số đó nằm lại trong hồ sơ để bạn tra.
      </Hop>
    </div>
  )
}
