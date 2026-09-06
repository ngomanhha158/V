import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Hop, PageHead, Trong } from '@/components/ui'
import { QuySo, type DongQuy } from '@/components/quy-so'
import { khuToiO } from '@/lib/khu-cu-dan'

/**
 * Sổ quỹ bảo trì, cho cư dân.
 *
 * Đây là màn quan trọng hơn màn của BQL: quỹ 2% là tiền của cư dân, và cơ chế
 * giám sát duy nhất thật sự hoạt động là ai cũng mở ra xem được. Siết quyền ghi
 * mà không ai đọc thì vẫn là một cuốn sổ chỉ người giữ tiền nhìn thấy.
 *
 * Quỹ 2% để RIÊNG theo từng khu — mỗi khu một tài khoản, một cuốn sổ. Nên cư
 * dân có căn ở hai khu phải thấy hai cuốn, không phải cuốn của khu đầu bảng.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const khu = await khuToiO()
  const theoKhu = await Promise.all(khu.map(async (k) => {
    const [{ data: dong, error }, { data: tk }] = await Promise.all([
      db.rpc('quy_so_ke_toan', { p_project: k.id }),
      db.from('quy_bao_tri').select('ngan_hang, so_tai_khoan, so_du_ngan_hang, doi_chieu_ngay')
        .eq('project_id', k.id).maybeSingle(),
    ])
    return { khu: k, dong: (dong ?? []) as DongQuy[], error, tk }
  }))
  const nhieuKhu = theoKhu.length > 1

  return (
    <div className="space-y-5">
      <PageHead
        title="Quỹ bảo trì 2%"
        sub="Tiền của cư dân, để riêng một tài khoản — mọi khoản chi phải có nghị quyết BQT"
      />

      {khu.length === 0 && (
        <Trong title="Tài khoản chưa gắn với căn hộ nào">
          Sổ quỹ đọc theo căn bạn đang ở. Nhờ ban quản lý gắn tài khoản vào căn
          của bạn, rồi mở lại màn này.
        </Trong>
      )}

      {theoKhu.map((t) => (
        <section key={t.khu.id} className="space-y-5">
          {nhieuKhu && (
            <h2 className="px-1 text-[0.75rem] font-semibold tracking-wider text-faint uppercase">
              {t.khu.name}
            </h2>
          )}

          {t.error && (
            <Hop tone="xau" title="Không đọc được sổ quỹ">
              {t.error.code === '42883' || t.error.code === '42P01'
                ? 'Phần quỹ bảo trì chưa có trên database. Báo ban quản lý.'
                : t.error.message}
            </Hop>
          )}

          {!t.error && (
            <QuySo
              dong={t.dong}
              nganHang={t.tk?.ngan_hang || undefined}
              soTaiKhoan={t.tk?.so_tai_khoan || undefined}
              soDuNganHang={t.tk?.so_du_ngan_hang ?? null}
              doiChieuNgay={t.tk?.doi_chieu_ngay ?? null}
            />
          )}
        </section>
      ))}

      <Hop tone="trung" title="Chốt sổ bàn giao">
        Khi tòa nhà đổi đơn vị quản lý, số dư quỹ và công nợ toàn khu được khóa
        lại thành một bản chốt mà hai bên cùng ký.{' '}
        <Link href="/ban-giao" className="font-medium text-brand hover:underline">
          Xem các bản chốt →
        </Link>
      </Hop>

      <Hop tone="trung" title="Sổ này không sửa được">
        Ghi sai thì phải ghi thêm một bút toán đảo, và cả hai dòng cùng nằm lại
        trong sổ — nên một lần sai luôn nhìn thấy được. Thấy khoản nào chưa rõ,
        hỏi ở{' '}
        <Link href="/bang-tin" className="font-medium text-brand hover:underline">
          Bảng tin
        </Link>{' '}
        để cả tòa cùng đọc câu trả lời.
      </Hop>
    </div>
  )
}
