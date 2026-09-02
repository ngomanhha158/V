'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type BangTinState = { error?: string; ok?: string }

/** '' -> null. Form gửi chuỗi rỗng cho ô không chọn, mà cột thì cần NULL. */
const rong = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export async function dangThongBao(
  _prev: BangTinState, form: FormData,
): Promise<BangTinState> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Chưa đăng nhập.' }

  const { data: project } = await db.from('projects').select('id').limit(1).maybeSingle()
  if (!project) return { error: 'Chưa có dự án nào.' }

  const title = rong(form.get('title'))
  const body = rong(form.get('body'))
  if (!title || !body) return { error: 'Tiêu đề và nội dung không được để trống.' }

  const floorRaw = rong(form.get('floor_no'))
  const floor = floorRaw === null ? null : Number(floorRaw)
  if (floor !== null && !Number.isInteger(floor)) {
    return { error: 'Tầng phải là số nguyên.' }
  }

  // Nhắm theo tầng mà không chọn tòa thì "tầng 12" nghĩa là tầng 12 của MỌI
  // tòa — gần như luôn là nhầm. Chặn ở đây thay vì để BQL phát hiện sau khi
  // cả khu đã nhận tin.
  const building = rong(form.get('building_id'))
  if (floor !== null && !building) {
    return { error: 'Chọn tầng thì phải chọn tòa, nếu không tin sẽ tới tầng đó ở mọi tòa.' }
  }

  const unit = rong(form.get('unit_id'))
  const phatHanhNgay = form.get('phat_hanh') === '1'

  // RLS (announcement_staff_write) là chốt chặn: không phải BQL thì insert bị từ chối.
  const { error } = await db.from('announcements').insert({
    project_id: project.id,
    building_id: unit ? null : building,   // nhắm 1 căn thì tòa/tầng thừa
    floor_no: unit ? null : floor,
    unit_id: unit,
    title,
    body,
    document_id: rong(form.get('document_id')),
    is_urgent: form.get('is_urgent') === '1',
    published_at: phatHanhNgay ? new Date().toISOString() : null,
    author_id: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
  return { ok: phatHanhNgay ? 'Đã phát hành thông báo.' : 'Đã lưu bản nháp.' }
}

export async function phatHanh(id: string) {
  const db = await createClient()
  const { error } = await db
    .from('announcements')
    .update({ published_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
}

export async function xoaThongBao(id: string) {
  const db = await createClient()
  const { error } = await db.from('announcements').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
}

// ─────────────────── Thăm dò và kiểm duyệt bình luận ───────────────────

export type GopYState = { error?: string; ok?: string }

function dichLoiGopY(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Bạn không có quyền làm việc này trên khu của mình.'
  if (code === '23505') return 'Thông báo này đã có một cuộc thăm dò rồi.'
  if (code === '23514') return 'Cần từ 2 tới 8 lựa chọn, mỗi lựa chọn không để trống.'
  if (code === '42P01') {
    return 'Phần thăm dò chưa có trên database. Chạy lại schema.sql rồi thử lại.'
  }
  return msg
}

export async function themThamDo(_prev: GopYState, formData: FormData): Promise<GopYState> {
  const tb = String(formData.get('tb') ?? '')
  const cauHoi = String(formData.get('cau_hoi') ?? '').trim()
  // Mỗi dòng một lựa chọn: người ta gõ danh sách theo dòng, không gõ theo dấu
  // phẩy — mà lựa chọn thì hay có dấu phẩy bên trong.
  const luaChon = String(formData.get('lua_chon') ?? '')
    .split('\n').map((s) => s.trim()).filter(Boolean)
  const kin = formData.get('kin') === '1'
  const dong = String(formData.get('dong_luc') ?? '').trim()

  if (!tb) return { error: 'Thiếu thông báo.' }
  if (!cauHoi) return { error: 'Chưa nhập câu hỏi.' }
  if (luaChon.length < 2) return { error: 'Cần ít nhất 2 lựa chọn, mỗi lựa chọn một dòng.' }
  if (luaChon.length > 8) return { error: `Tối đa 8 lựa chọn, đang có ${luaChon.length}.` }
  if (new Set(luaChon).size !== luaChon.length) {
    return { error: 'Có hai lựa chọn trùng chữ — người bỏ phiếu sẽ không phân biệt được.' }
  }

  const db = await createClient()
  const { error } = await db.from('announcement_polls').insert({
    announcement_id: tb, cau_hoi: cauHoi, lua_chon: luaChon, kin,
    dong_luc: dong ? new Date(dong).toISOString() : null,
  })
  if (error) return { error: dichLoiGopY(error.code, `Không tạo được: ${error.message}`) }

  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
  return {
    ok: kin
      ? 'Đã tạo. Kết quả giấu cho tới khi đóng, nên người bỏ sau không bị số đang chạy kéo theo.'
      : 'Đã tạo. Kết quả hiện ngay cho cư dân.',
  }
}

/**
 * Ẩn hoặc bỏ ẩn một bình luận.
 *
 * ẨN chứ không XÓA, và không có nút xóa ở đâu cả: xóa được là BQL xóa sạch lời
 * chê mà không để lại dấu. Ẩn thì dòng vẫn còn, nhật ký kiểm toán vẫn ghi ai
 * ẩn lúc nào, và màn cư dân vẫn hiện "một ý kiến đã được ẩn".
 */
export async function doiAnBinhLuan(_prev: GopYState, formData: FormData): Promise<GopYState> {
  const id = Number(formData.get('id'))
  const an = formData.get('an') === '1'
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!Number.isInteger(id)) return { error: 'Thiếu bình luận.' }
  if (an && !lyDo) return { error: 'Ghi lý do ẩn — để sau này còn giải trình được.' }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Phiên đăng nhập đã hết.' }

  const { error } = await db.from('announcement_comments').update(
    an
      ? { an_luc: new Date().toISOString(), an_boi: user.id, an_ly_do: lyDo }
      : { an_luc: null, an_boi: null, an_ly_do: null },
  ).eq('id', id)
  if (error) return { error: dichLoiGopY(error.code, `Không đổi được: ${error.message}`) }

  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
  return { ok: an ? 'Đã ẩn khỏi màn cư dân. Dòng vẫn còn trong hệ thống.' : 'Đã hiện lại.' }
}
