/**
 * Tên tiếng Việt của các vai trò nhân sự.
 *
 * Để riêng một file không phụ thuộc gì: màn thật và màn demo cùng dùng, mà
 * màn demo thì KHÔNG được kéo theo server action nào — import từ form.tsx là
 * lôi cả actions.ts vào bản demo.
 */
export const TEN_VAI_TRO: Record<string, string> = {
  bql_manager: 'Trưởng ban quản lý',
  bql_staff: 'Nhân viên BQL',
  technician: 'Kỹ thuật',
  security: 'Bảo vệ',
  bqt: 'Ban quản trị',
}

export const tenVaiTro = (v: string) => TEN_VAI_TRO[v] ?? v

/**
 * Nhãn tiếng Việt cho vai trò trong CĂN HỘ (khác vai trò nhân sự ở trên).
 *
 * Gom về đây vì trước đó có bốn bản chép tay và chúng đã lệch nhau: cùng
 * `family` mà màn trang chủ gọi là "Thành viên", nhật ký gọi là "Người nhà".
 * Người dùng thấy hai cái tên cho cùng một thứ thì họ tưởng đó là hai thứ.
 */
export const NHAN_VAI_CAN: Record<string, string> = {
  owner: 'Chủ hộ',
  authorized: 'Người được ủy quyền',
  tenant: 'Người thuê',
  family: 'Người nhà',
}

export const vaiCan = (v: string | null | undefined) =>
  (v && NHAN_VAI_CAN[v]) || v || '—'

/**
 * Lý do thẻ không dùng được → câu bảo vệ đọc ở cửa.
 *
 * Mỗi câu phải nói được PHẢI LÀM GÌ, không chỉ nói cái gì sai: bảo vệ đang
 * đứng trước một người thật, có hàng người sau lưng, và "không hợp lệ" trống
 * không thì họ chỉ còn cách gọi điện cho ban quản lý.
 */
export const LY_DO_THE: Record<string, string> = {
  het_han: 'Hợp đồng thuê đã hết hạn. Mời liên hệ ban quản lý để gia hạn.',
  chua_toi_han: 'Hợp đồng chưa tới ngày bắt đầu. Chưa được vào bằng thẻ này.',
  cho_duyet: 'Yêu cầu gia nhập chưa được ban quản lý duyệt.',
  da_thu_hoi: 'Tư cách thành viên đã bị thu hồi.',
  ngung: 'Tư cách thành viên không còn hiệu lực.',
  khong_thuoc: 'Người này không có tư cách gì ở căn hộ trên thẻ.',
}
