'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type GhiSoState = { error?: string; ok?: string }

/** Ghi giờ vào (hoặc giờ ra) vào sổ. Tách khỏi lần mở trang: xem thử không ghi. */
export async function ghiSo(_prev: GhiSoState, formData: FormData): Promise<GhiSoState> {
  const ma = String(formData.get('ma') ?? '')
  if (!ma) return { error: 'Thiếu mã.' }

  const db = await createClient()
  const { data, error } = await db.rpc('quet_khach', { p_ma: ma, p_ghi: true })
  if (error) {
    if (error.code === '42501') return { error: 'Tài khoản này không quét được mã của dự án đó.' }
    return { error: `Không ghi được: ${error.message}` }
  }
  const k = data?.[0]
  if (!k || !k.cho_vao) {
    return { error: k?.loi ?? 'Mã không dùng được nữa — mở lại trang để xem lý do.' }
  }

  revalidatePath(`/quet/k/${ma}`)
  // Nói ra ĐÃ GHI GÌ, không nói "đã lưu". Bảo vệ bấm nhầm nút lúc khách vào và
  // lúc khách ra là hai sự việc khác nhau trong sổ.
  return {
    ok: k.ra_luc
      ? `Đã ghi giờ RA cho ${k.ho_ten}. Lượt này xong, mã không dùng lại được.`
      : `Đã ghi giờ VÀO cho ${k.ho_ten}. Lúc khách về, quét lại mã này để ghi giờ ra.`,
  }
}
