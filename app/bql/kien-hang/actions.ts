'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { LOAI_KIEN } from '@/lib/kien-hang'

export type KienState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Chỉ nhân sự của dự án này mới thao tác được với kiện hàng.'
  if (code === '42883' || code === '42P01') {
    return 'Phần nhận hàng hộ chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

export async function nhanKien(_prev: KienState, formData: FormData): Promise<KienState> {
  const ma = String(formData.get('unit_ma') ?? '').trim().toUpperCase()
  const loai = String(formData.get('loai') ?? 'kien_nho')
  if (!ma) return { error: 'Chưa nhập mã căn. Không biết của ai thì không nhận được.' }
  if (!(LOAI_KIEN as readonly string[]).includes(loai)) return { error: 'Loại kiện không hợp lệ.' }

  const db = await createClient()
  // Bảo vệ gõ MÃ CĂN, không phải uuid. Tra ở server chứ không tin ô ẩn trong
  // form: mã gõ sai thì phải nói ra ngay, chứ không ghi kiện vào một căn khác.
  const { data: can, error: loiCan } = await db
    .from('units').select('id, code').eq('code', ma).maybeSingle()
  if (loiCan) return { error: dichLoi(loiCan.code, `Không tra được căn: ${loiCan.message}`) }
  if (!can) {
    return { error: `Không có căn nào mã "${ma}". Kiểm lại — ghi nhầm căn thì thông báo bay tới nhà người khác.` }
  }
  const unit = can.id

  const { error } = await db.rpc('nhan_kien_hang', {
    p_unit: unit, p_loai: loai,
    p_nha_van_chuyen: String(formData.get('nha_van_chuyen') ?? '').trim() || null,
    p_ma_van_don: String(formData.get('ma_van_don') ?? '').trim() || null,
    p_vi_tri: String(formData.get('vi_tri') ?? '').trim() || null,
    p_ghi_chu: String(formData.get('ghi_chu') ?? '').trim() || null,
  })
  if (error) return { error: dichLoi(error.code, `Không ghi được: ${error.message}`) }

  revalidatePath('/bql/kien-hang')
  revalidatePath('/hang')
  return { ok: 'Đã ghi nhận. Cư dân của căn nhận thông báo ngay bây giờ.' }
}

export async function huyKien(_prev: KienState, formData: FormData): Promise<KienState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu kiện hàng.' }
  if (lyDo.length < 5) {
    return { error: 'Ghi lý do — cư dân đọc được đúng dòng chữ này khi mở màn hàng của họ.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('huy_kien_hang', { p_kien: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514') {
      return { error: 'Kiện này đã trao rồi — không hủy được, vì hủy là xóa mất chính dòng ghi đã trao cho ai.' }
    }
    if (error.code === '23505') return { error: 'Kiện này đã hủy rồi.' }
    return { error: dichLoi(error.code, `Không hủy được: ${error.message}`) }
  }

  revalidatePath('/bql/kien-hang')
  revalidatePath('/hang')
  return { ok: 'Đã hủy. Cư dân thấy lý do bạn vừa ghi.' }
}
