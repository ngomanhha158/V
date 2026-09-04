import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Hop, PageHead } from '@/components/ui'
import { QuySo, type DongQuy } from '@/components/quy-so'

/**
 * Sổ quỹ bảo trì, cho cư dân.
 *
 * Đây là màn quan trọng hơn màn của BQL: quỹ 2% là tiền của cư dân, và cơ chế
 * giám sát duy nhất thật sự hoạt động là ai cũng mở ra xem được. Siết quyền ghi
 * mà không ai đọc thì vẫn là một cuốn sổ chỉ người giữ tiền nhìn thấy.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Quỹ bảo trì 2%" />
        <Hop tone="canh" title="Chưa có dữ liệu tòa nhà">Liên hệ ban quản lý.</Hop>
      </div>
    )
  }

  const [{ data: dong, error }, { data: tk }] = await Promise.all([
    db.rpc('quy_so_ke_toan', { p_project: project.id }),
    db.from('quy_bao_tri').select('ngan_hang, so_tai_khoan, so_du_ngan_hang, doi_chieu_ngay')
      .eq('project_id', project.id).maybeSingle(),
  ])

  return (
    <div className="space-y-5">
      <PageHead
        title="Quỹ bảo trì 2%"
        sub="Tiền của cư dân, để riêng một tài khoản — mọi khoản chi phải có nghị quyết BQT"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được sổ quỹ">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần quỹ bảo trì chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {!error && (
        <QuySo
          dong={(dong ?? []) as DongQuy[]}
          nganHang={tk?.ngan_hang || undefined}
          soTaiKhoan={tk?.so_tai_khoan || undefined}
          soDuNganHang={tk?.so_du_ngan_hang ?? null}
          doiChieuNgay={tk?.doi_chieu_ngay ?? null}
        />
      )}

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
