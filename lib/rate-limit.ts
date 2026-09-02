/**
 * Đếm lượt theo cửa sổ cố định, giữ trong bộ nhớ tiến trình.
 *
 * GIỚI HẠN, nói trước cho khỏi tưởng nhầm: bộ đếm nằm trong RAM của MỘT tiến
 * trình. Chạy nhiều bản sao trên Railway thì mỗi bản đếm riêng, nên ngưỡng
 * thực tế bị nhân lên theo số bản sao. Nó vẫn cắt được kiểu dò khóa bắn hàng
 * nghìn lượt một phút — thứ nó không thay thế được là rate limit ở tầng biên
 * (Cloudflare / Railway) và bộ đếm lượt đăng nhập trong railway/03_auth.sql.
 *
 * Cố ý không kéo Redis về: thêm một dịch vụ trạng thái nữa vào đường tiền là
 * thêm một chỗ chết. Khi nào cần chính xác thật thì mới đổi.
 */

type CuaSo = { dem: number; hetHan: number }

const kho = new Map<string, CuaSo>()

/** Trần số khóa. Kẻ tấn công đổi IP liên tục sẽ bơm map phình ra tới hết RAM. */
const TRAN_KHOA = 10_000

export type KetQua = { chan: boolean; conLai: number; choMs: number }

/**
 * `now` chỉ để test bơm đồng hồ vào. Không có nó thì test ranh giới cửa sổ
 * phải đua với đồng hồ thật — bốn lời gọi phải rơi trọn trong cùng một mili
 * giây, và cứ vài lần chạy lại hỏng một lần. Đường chạy thật không truyền
 * tham số này.
 */
export function demLuot(
  khoa: string, gioiHan: number, cuaSoMs: number, now: number = Date.now(),
): KetQua {

  // Quét dọn ngay trong lời gọi, không dùng setInterval: route handler có thể
  // bị đóng băng giữa các request, timer không đáng tin ở đó.
  if (kho.size > TRAN_KHOA) {
    for (const [k, v] of kho) if (v.hetHan <= now) kho.delete(k)
    // Vẫn quá tải sau khi dọn -> xóa sạch. Thà đếm lại từ đầu còn hơn hết RAM.
    if (kho.size > TRAN_KHOA) kho.clear()
  }

  const cu = kho.get(khoa)
  if (!cu || cu.hetHan <= now) {
    kho.set(khoa, { dem: 1, hetHan: now + cuaSoMs })
    return { chan: false, conLai: gioiHan - 1, choMs: 0 }
  }

  cu.dem += 1
  if (cu.dem > gioiHan) {
    return { chan: true, conLai: 0, choMs: cu.hetHan - now }
  }
  return { chan: false, conLai: gioiHan - cu.dem, choMs: 0 }
}

/** Xóa bộ đếm của một khóa — gọi khi request thành công. */
export function xoaLuot(khoa: string) {
  kho.delete(khoa)
}

/** Chỉ dùng trong test. */
export function _reset() {
  kho.clear()
}

/**
 * IP của client sau proxy.
 *
 * Lấy phần tử CUỐI của x-forwarded-for, không phải phần tử đầu. Client tự gửi
 * được header này; proxy của Railway NỐI THÊM ip thật vào cuối. Lấy phần tử
 * đầu là để kẻ tấn công tự bịa một "IP" mới cho mỗi request và đi vòng qua
 * toàn bộ bộ đếm.
 */
export function ipClient(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const phan = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (phan.length) return phan[phan.length - 1]
  }
  return req.headers.get('x-real-ip') ?? 'khong-ro'
}
