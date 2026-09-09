/**
 * Đường ra database cho MCP server.
 *
 * KHÔNG ký token ở đây. Server này cầm một token ĐÃ KÝ SẴN (VBUILDING_TOKEN),
 * phát từ scripts/tao-token-mcp.ts chạy trên Railway. Khoá ký ở lại máy chủ.
 *
 * Hệ quả quan trọng: mọi truy vấn đi qua PostgREST với vai `authenticated` và
 * `sub` của một người thật, nên RLS chặn y hệt như khi người đó dùng web. MCP
 * không có đường vòng nào — không phơi ra được thứ mà người đó tự mở web cũng
 * không xem được.
 */
import { taoClient, type Client } from '../lib/db/postgrest.ts'

export class LoiCauHinh extends Error {}

export function docToken(): string {
  const t = process.env.VBUILDING_TOKEN?.trim()
  if (!t) {
    throw new LoiCauHinh(
      'Thiếu VBUILDING_TOKEN. Phát bằng: npx tsx scripts/tao-token-mcp.ts <email> '
      + '— chạy TRÊN RAILWAY, nơi có AUTH_JWT_SECRET. Đừng đặt AUTH_JWT_SECRET ở máy này.',
    )
  }
  // Chặn nhầm lẫn hay gặp nhất: dán khoá ký vào chỗ của token. JWT có đúng hai
  // dấu chấm; khoá ký thì không. Bắt ở đây, chứ để nó đi tới PostgREST thì lỗi
  // trả về là "JWSError" — đúng và vô dụng với người đang dán nhầm.
  if (t.split('.').length !== 3) {
    throw new LoiCauHinh(
      'VBUILDING_TOKEN không phải JWT (JWT có 3 phần ngăn bởi dấu chấm). '
      + 'Có phải đang dán nhầm AUTH_JWT_SECRET không? Cần token phát ra từ '
      + 'scripts/tao-token-mcp.ts, không phải khoá ký.',
    )
  }
  return t
}

export function moKetNoi(): Client {
  return taoClient(docToken(), null)
}

/**
 * Khu đang quản lý.
 *
 * Mọi RPC vận hành đều nhận p_project. Bắt người dùng nhớ UUID là vô lý, mà
 * đoán bừa "khu đầu bảng" cũng sai — với hai khu trở lên nó im lặng chọn hộ.
 * Nên: một khu thì tự lấy; nhiều khu mà không nói tên thì DỪNG và liệt kê ra.
 */
export async function chonKhu(db: Client, ten?: string) {
  const { data, error } = await db.from('projects').select('id, name').order('name')
  if (error) throw new Error(`Không đọc được danh sách khu: ${error.code ?? ''} ${error.message}`)
  const ds = data ?? []
  if (ds.length === 0) {
    throw new Error('Tài khoản này không thấy khu nào. Kiểm tra quyền BQL (staff_assignments).')
  }
  if (ten) {
    const kh = ds.filter((k) => k.name.toLowerCase().includes(ten.toLowerCase()))
    if (kh.length === 1) return kh[0]
    if (kh.length === 0) {
      throw new Error(`Không có khu nào tên chứa "${ten}". Đang có: ${ds.map((k) => k.name).join(', ')}`)
    }
    throw new Error(`"${ten}" khớp nhiều khu: ${kh.map((k) => k.name).join(', ')}. Ghi rõ hơn.`)
  }
  if (ds.length === 1) return ds[0]
  throw new Error(
    `Có ${ds.length} khu, phải nói rõ khu nào: ${ds.map((k) => k.name).join(', ')}`,
  )
}
