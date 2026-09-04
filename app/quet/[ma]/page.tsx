import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { biMatJwt } from '@/lib/db/env'
import { docThe } from '@/lib/the'
import { LY_DO_THE, vaiCan } from '@/lib/vai-tro'
import { NutTrao } from './kien'

/**
 * Màn bảo vệ quét thẻ.
 *
 * Mã QR chứa một URL trỏ thẳng vào đây, nên bảo vệ dùng ĐÚNG app camera có sẵn
 * trên điện thoại — không cài gì, không xin quyền gì, không phụ thuộc trình
 * duyệt nào hỗ trợ BarcodeDetector. Đổi lại, mã nằm trong lịch sử duyệt web
 * của máy bảo vệ; chấp nhận được vì mã chết sau một phút, và trang này vẫn đòi
 * phiên đăng nhập của nhân sự mới hiện ra được gì.
 */
export const dynamic = 'force-dynamic'

function Hong({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md p-4 pb-10">
      <div className="rounded-card bg-bad px-5 py-6 text-center text-white">
        <p className="text-[1.75rem] leading-tight font-extrabold tracking-tight">KHÔNG QUÉT ĐƯỢC</p>
        <p className="mt-1.5 text-[0.9375rem] leading-snug opacity-95">{title}</p>
      </div>
      <div className="mt-3 rounded-card border border-line bg-surface p-4 text-[0.875rem] leading-relaxed text-muted">
        {children}
      </div>
      <p className="mt-4 text-[0.8125rem]">
        <Link href="/quet" className="font-medium text-brand hover:underline">Hướng dẫn quét</Link>
      </p>
    </div>
  )
}

export default async function Page({ params }: { params: Promise<{ ma: string }> }) {
  const the = docThe((await params).ma, biMatJwt())
  if (!the) {
    return (
      <Hong title="Mã không dùng được">
        Mã đã hết hạn hoặc không phải mã do hệ thống này cấp. Mã chỉ sống một
        phút — nhờ cư dân mở lại màn <strong>Thẻ cư dân</strong> rồi quét lại.
      </Hong>
    )
  }

  const db = await createClient()
  const { data, error } = await db.rpc('kiem_the', { p_uid: the.uid, p_unit: the.unit })
  if (error) {
    if (error.code === '42501') {
      return (
        <Hong title="Bạn không tra được thẻ của khu này">
          Chỉ nhân sự của đúng dự án mới quét được. Nếu bạn là bảo vệ ở đây,
          nhờ trưởng ban quản lý gán vai trò cho tài khoản này.
        </Hong>
      )
    }
    if (error.code === 'P0002') {
      return <Hong title="Căn hộ trên thẻ không còn tồn tại">Báo ban quản lý kiểm tra lại danh sách căn.</Hong>
    }
    if (error.code === '42883') {
      return <Hong title="Chưa cài phần thẻ cư dân">Chạy lại schema.sql rồi auth_hooks.sql trên database.</Hong>
    }
    return <Hong title="Không tra được thẻ">{error.message}</Hong>
  }

  const r = data?.[0]
  if (!r) return <Hong title="Không tìm thấy người trên thẻ">Tài khoản có thể đã bị xóa.</Hong>

  const ok = r.con_hieu_luc

  // Kiện quầy đang giữ cho căn này. Hỏi NGAY TRÊN MÀN QUÉT chứ không bắt bảo vệ
  // mở thêm một trang: người ta đứng trước mặt nhau ở quầy, thêm một bước là
  // thêm một lần "để lát nữa" — và "lát nữa" là lúc quyển sổ giấy quay lại.
  // Chỉ hỏi khi thẻ HỢP LỆ: thẻ hỏng thì không có gì để trao.
  const { data: kienDs } = ok
    ? await db
        .from('kien_hang')
        .select('id, loai, vi_tri, nha_van_chuyen, ma_van_don')
        .eq('unit_id', the.unit)
        .is('tra_luc', null)
        .is('huy_luc', null)
        .order('nhan_luc')
    : { data: [] }
  return (
    <div className="mx-auto max-w-md p-4 pb-10">
      {/* Kết luận chiếm nguyên một mảng màu, chữ to. Bảo vệ nhìn màn này nửa
          giây ở cửa, có người đứng chờ phía sau: câu trả lời phải đọc được từ
          tầm tay, không phải một dòng chữ nhỏ trong tiêu đề thẻ. Trang này cố
          ý KHÔNG mang thanh nav của BQL — mọi thứ khác trên màn đều là thứ che
          mất câu trả lời. */}
      <div
        className={`rounded-card px-5 py-6 text-center ${
          ok ? 'bg-ok text-white' : 'bg-bad text-white'
        }`}
      >
        <p className="text-[1.75rem] leading-tight font-extrabold tracking-tight">
          {ok ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}
        </p>
        <p className="mt-1.5 text-[0.9375rem] leading-snug opacity-95">
          {ok ? 'Mời vào.' : (LY_DO_THE[r.ly_do] ?? `Thẻ không còn hiệu lực (${r.ly_do}).`)}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-4 rounded-card border border-line bg-surface p-4">
        {r.anh
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.anh} alt="" className="size-20 shrink-0 rounded-full object-cover" />
          : (
            // Nói thẳng là không có ảnh. Một ô trống làm bảo vệ tưởng ảnh chưa
            // tải xong rồi đứng chờ, giữa lúc có hàng người phía sau.
            <span className="grid size-20 shrink-0 place-items-center rounded-full border border-dashed border-line-firm text-center text-[0.6875rem] leading-tight text-faint">
              Chưa có ảnh
            </span>
          )}
        <div className="min-w-0">
          <p className="text-[1.125rem] leading-tight font-semibold text-ink">
            {r.ho_ten ?? 'Không rõ tên'}
          </p>
          <p className="num mt-0.5 text-[1rem] font-medium text-muted">{r.can}</p>
          <p className="text-[0.8125rem] text-faint">
            {r.toa}{r.vai_tro ? ` · ${vaiCan(r.vai_tro)}` : ''}
          </p>
        </div>
      </div>

      {ok && (kienDs ?? []).length > 0 && (
        <div className="mt-3 rounded-card border border-warn-line bg-warn-soft p-4">
          <p className="text-[0.9375rem] font-semibold text-warn">
            Quầy đang giữ {(kienDs ?? []).length} kiện cho căn này
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
            Trao ở đây là sổ ghi lại đúng người vừa quét thẻ — không cần ký giấy.
          </p>
          <div className="mt-2 divide-y divide-warn-line">
            {(kienDs ?? []).map((k) => (
              <NutTrao
                key={k.id}
                id={k.id}
                uid={the.uid}
                loai={k.loai}
                moTa={[k.nha_van_chuyen, k.ma_van_don, k.vi_tri].filter(Boolean).join(' · ')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bảo vệ đối chiếu MẶT NGƯỜI, không đối chiếu cái tên với chính nó. Nói
          ra ở đây vì đó là bước duy nhất hệ thống không làm thay được.
          Chỉ hiện khi thẻ HỢP LỆ: trên màn đỏ thì câu "mã hợp lệ chỉ chứng
          minh..." nói về một chuyện không xảy ra, và bảo vệ đang vội thì đọc
          nhầm thành thẻ vẫn dùng được. */}
      {ok ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
          Mặt người đứng trước bạn có khớp ảnh và tên trên đây không? Mã hợp lệ chỉ
          chứng minh <strong className="text-ink">chiếc điện thoại này</strong> đang
          giữ thẻ của căn {r.can} — nó không chứng minh người cầm máy là ai.
        </p>
      ) : (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
          Người này <strong className="text-ink">chưa được vào bằng thẻ</strong>.
          Nếu họ nói có nhầm lẫn, mời liên hệ ban quản lý — bạn không sửa được
          hợp đồng từ màn này.
        </p>
      )}

      <p className="mt-4 text-[0.8125rem]">
        <Link href="/quet" className="font-medium text-brand hover:underline">
          Hướng dẫn quét
        </Link>
      </p>
    </div>
  )
}
