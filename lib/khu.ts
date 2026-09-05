/**
 * Khu (dự án) đang xem — phần LUẬT, không đụng cookie hay database.
 *
 * Tách khỏi lib/du-an.ts để chạy được dưới `node --test`: file kia import
 * next/headers và client database, nạp vào là chết ngay từ dòng import. Mà đúng
 * cái phần đáng test lại nằm ở đây — "cookie bịa thì rơi về đâu" là câu hỏi
 * không cần đến Postgres để trả lời.
 */

export type Khu = {
  id: string
  name: string
  so_toa: number
  so_can: number
  vai_tro: string | null
}

/**
 * Khu đang xem, suy từ danh sách khu được quản lý và lựa chọn lưu trong cookie.
 *
 * KHÔNG TIN COOKIE: nó do trình duyệt gửi lên. Một id bịa, hay một khu người
 * này vừa bị gỡ quyền, phải rơi về khu đầu danh sách — chứ không được làm màn
 * hình trống trơn mà không nói vì sao. Trống chỉ đúng khi danh sách thật sự rỗng.
 */
export function khuDaChon(ds: Khu[], luu: string | null | undefined): Khu | null {
  if (ds.length === 0) return null
  if (!luu) return ds[0]
  return ds.find((k) => k.id === luu) ?? ds[0]
}

/**
 * Có hiện hộp chọn khu không.
 *
 * Một hộp chọn có đúng một lựa chọn là một câu hỏi không có câu trả lời nào
 * khác. Nó chỉ chiếm chỗ và làm người dùng tưởng mình đang thiếu quyền ở đâu đó.
 */
export const nenHienHopChon = (ds: Khu[]) => ds.length >= 2

/** "3 tòa · 468 căn" — con số để người trực nhận ra khu, thay cho uuid. */
export const soLieuKhu = (k: Khu) => `${k.so_toa} tòa · ${k.so_can} căn`

/**
 * Khu chưa nhập căn nào thì nói thẳng phải làm gì.
 *
 * Một khu vừa ký hợp đồng hiện "0 căn" không kèm lời nào trông y hệt một lỗi
 * quyền — và người dùng sẽ đi tìm lỗi quyền.
 */
export function canhBaoKhu(k: Khu): string | null {
  if (k.so_can > 0) return null
  return 'Khu này chưa có căn nào. Nhập danh sách căn ở màn “Nhập từ Excel” trước khi phát hành hóa đơn hay mở biểu quyết.'
}
