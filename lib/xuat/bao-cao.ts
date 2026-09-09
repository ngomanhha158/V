/**
 * Bốn báo cáo Excel: định nghĩa cột, thuần dữ liệu.
 *
 * Không đụng database và không import exceljs — nhờ vậy test được, và màn demo
 * bày đúng bộ cột của file thật thay vì một bảng bịa riêng.
 */

export type KieuCot = 'chu' | 'tien' | 'so' | 'ngay' | 'ngaygio'

/**
 * Mã định dạng của Excel dùng dấu phẩy làm **chỗ đặt** phân nhóm nghìn, không
 * phải ký tự hiện ra: Excel thay nó bằng dấu phân nhóm theo vùng của người mở
 * file, nên máy cài tiếng Việt thấy 1.287.000. Đổi thành '#.##0' cho "đúng
 * kiểu Việt" là hỏng — trong mã định dạng, dấu chấm là dấu THẬP PHÂN.
 */
export const DINH_DANG: Record<KieuCot, string | undefined> = {
  chu: undefined,
  tien: '#,##0',
  so: '#,##0.##',
  ngay: 'dd/mm/yyyy',
  ngaygio: 'dd/mm/yyyy hh:mm',
}

export type Cot = { nhan: string; khoa: string; kieu: KieuCot; rong: number }

export type BaoCao = {
  id: string
  ten: string
  /** Tiền tố tên file. Không dấu: tên file có dấu phải mã hóa RFC 5987, và
   *  vài phần mềm kế toán cũ vẫn cắt mất phần dấu. */
  tep: string
  moTa: string
  /**
   * Báo cáo có gắn với một kỳ không.
   *
   * Công nợ thì KHÔNG: nó là ảnh chụp tại thời điểm bấm xuất, không phải số của
   * tháng nào. Hai người xuất cách nhau một ngày sẽ ra hai file khác nhau mà cả
   * hai đều đúng — nên thời điểm chốt phải nằm trong file.
   */
  theoKy: boolean
  cot: Cot[]
}

export const BAO_CAO: BaoCao[] = [
  {
    id: 'cong-no',
    ten: 'Công nợ theo căn',
    tep: 'cong-no',
    moTa: 'Mỗi căn còn nợ một dòng, kèm tuổi nợ và người liên hệ. Dùng để gọi nhắc '
      + 'và để đối chiếu với sổ kế toán.',
    theoKy: false,
    cot: [
      { nhan: 'Tòa', khoa: 'building_code', kieu: 'chu', rong: 8 },
      { nhan: 'Mã căn', khoa: 'unit_code', kieu: 'chu', rong: 14 },
      { nhan: 'Số hóa đơn còn nợ', khoa: 'so_hoa_don', kieu: 'so', rong: 18 },
      { nhan: 'Còn nợ', khoa: 'con_no', kieu: 'tien', rong: 16 },
      { nhan: 'Hạn cũ nhất', khoa: 'han_cu_nhat', kieu: 'ngay', rong: 14 },
      { nhan: 'Số ngày quá hạn', khoa: 'so_ngay_qua_han', kieu: 'so', rong: 16 },
      { nhan: 'Người liên hệ', khoa: 'ten_lien_he', kieu: 'chu', rong: 26 },
      { nhan: 'Điện thoại', khoa: 'dien_thoai', kieu: 'chu', rong: 16 },
    ],
  },
  {
    id: 'so-quy',
    ten: 'Sổ quỹ thu chi',
    tep: 'so-quy',
    moTa: 'Từng lần tiền về trong kỳ, kèm mã tham chiếu ngân hàng để tra ngược.',
    theoKy: true,
    cot: [
      { nhan: 'Thời điểm nộp', khoa: 'paid_at', kieu: 'ngaygio', rong: 20 },
      { nhan: 'Tòa', khoa: 'building_code', kieu: 'chu', rong: 8 },
      { nhan: 'Mã căn', khoa: 'unit_code', kieu: 'chu', rong: 14 },
      { nhan: 'Số tiền', khoa: 'amount', kieu: 'tien', rong: 16 },
      { nhan: 'Hình thức', khoa: 'method', kieu: 'chu', rong: 16 },
      { nhan: 'Mã tham chiếu NH', khoa: 'bank_ref', kieu: 'chu', rong: 22 },
      { nhan: 'Khớp bởi', khoa: 'matched_by', kieu: 'chu', rong: 12 },
      { nhan: 'Kỳ hóa đơn', khoa: 'ky_hoa_don', kieu: 'ngay', rong: 14 },
    ],
  },
  {
    id: 'hoa-don',
    ten: 'Chi tiết hóa đơn',
    tep: 'chi-tiet-hoa-don',
    moTa: 'Mỗi dòng phí một dòng bảng — mở ra là thấy hóa đơn được cấu thành từ gì.',
    theoKy: true,
    cot: [
      { nhan: 'Tòa', khoa: 'building_code', kieu: 'chu', rong: 8 },
      { nhan: 'Mã căn', khoa: 'unit_code', kieu: 'chu', rong: 14 },
      { nhan: 'Trạng thái', khoa: 'trang_thai', kieu: 'chu', rong: 14 },
      { nhan: 'Hạn thanh toán', khoa: 'due_date', kieu: 'ngay', rong: 16 },
      { nhan: 'Diễn giải', khoa: 'description', kieu: 'chu', rong: 34 },
      { nhan: 'Số lượng', khoa: 'quantity', kieu: 'so', rong: 12 },
      { nhan: 'Đơn giá', khoa: 'unit_price', kieu: 'tien', rong: 14 },
      { nhan: 'Thành tiền', khoa: 'amount', kieu: 'tien', rong: 16 },
      { nhan: 'Tổng hóa đơn', khoa: 'total_amount', kieu: 'tien', rong: 16 },
      { nhan: 'Đã trả', khoa: 'paid_amount', kieu: 'tien', rong: 16 },
    ],
  },
  {
    id: 'doi-soat',
    ten: 'Đối chiếu ngân hàng',
    tep: 'doi-chieu-ngan-hang',
    moTa: 'Mọi giao dịch ngân hàng bắn về trong kỳ, gồm cả giao dịch chưa khớp được '
      + 'vào căn nào — đó mới là phần cần soi.',
    theoKy: true,
    cot: [
      { nhan: 'Thời điểm', khoa: 'paid_at', kieu: 'ngaygio', rong: 20 },
      { nhan: 'Nhà cung cấp', khoa: 'provider', kieu: 'chu', rong: 14 },
      { nhan: 'Mã giao dịch', khoa: 'provider_ref', kieu: 'chu', rong: 22 },
      { nhan: 'Số tiền', khoa: 'amount', kieu: 'tien', rong: 16 },
      { nhan: 'Nội dung chuyển khoản', khoa: 'content', kieu: 'chu', rong: 40 },
      { nhan: 'Trạng thái', khoa: 'trang_thai', kieu: 'chu', rong: 14 },
      { nhan: 'Cách khớp', khoa: 'cach_khop', kieu: 'chu', rong: 14 },
      { nhan: 'Căn được gạch', khoa: 'unit_code', kieu: 'chu', rong: 14 },
      { nhan: 'Còn dư chưa gạch', khoa: 'con_du', kieu: 'tien', rong: 18 },
    ],
  },
]

export const baoCao = (id: string) => BAO_CAO.find((b) => b.id === id)

/** Kỳ hợp lệ là 'YYYY-MM'. Trả null nếu không đọc được — người gọi tự báo lỗi. */
export function docKy(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return null
  return s
}

/** Kỳ của tháng hiện tại, dạng 'YYYY-MM'. Tính theo UTC cho khớp cột date. */
export function kyHienTai(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Tên file. Có cả kỳ lẫn thời điểm chốt: hai lần xuất cùng một kỳ vẫn ra hai
 * file khác tên, nên không ai vô tình đè lên bản đã gửi đi rồi.
 */
/**
 * Tên khu rút gọn cho tên tệp: "Sunrise Riverside" -> "sunrise-riverside".
 *
 * Bỏ dấu chứ không giữ nguyên: Content-Disposition dùng `filename="..."` là
 * trường ASCII, chữ có dấu qua đó bị trình duyệt cắt hoặc thay bằng dấu hỏi —
 * và người dùng nhận về một tệp tên loang lổ, không phải một lỗi.
 *
 * Cắt 40 ký tự: tên khu dài cộng kỳ cộng mốc chốt vượt giới hạn tên tệp của
 * một số hệ thống, mà lúc đó phần bị cắt là phần ĐUÔI — tức là mốc chốt, đúng
 * cái phân biệt hai lần xuất.
 */
export function slugKhu(ten: string): string {
  return ten
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

/**
 * `khu` là THAM SỐ BẮT BUỘC, cố ý.
 *
 * Trước đây tên tệp chỉ có báo cáo + kỳ + mốc chốt, không có khu. Người quản lý
 * hai khu tải "Công nợ tháng 9" của cả hai được hai tệp TRÙNG TÊN: cái sau đè
 * cái trước trong thư mục Tải về, im lặng. Mà kể cả không đè — mở tệp
 * `cong-no_2026-09_...xlsx` một tuần sau thì không có cách nào biết nó là khu
 * nào cho tới lúc mở ra đọc dòng tiêu đề bên trong.
 *
 * Để tham số này tuỳ chọn thì lỗi cũ quay lại lúc nào không ai biết. Bắt buộc
 * thì TypeScript không cho dựng một tên tệp mà không nói nó thuộc khu nào.
 */
export function tenTep(bc: BaoCao, ky: string | null, chotLuc: Date, khu: string): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const dau = `${chotLuc.getUTCFullYear()}${p(chotLuc.getUTCMonth() + 1)}${p(chotLuc.getUTCDate())}`
    + `-${p(chotLuc.getUTCHours())}${p(chotLuc.getUTCMinutes())}`
  // slug rỗng được: tên khu toàn ký tự lạ thì bỏ phần đó đi, chứ không dựng ra
  // `cong-no__2026-09_...` với hai gạch dưới liền nhau.
  return [bc.tep, slugKhu(khu) || null, bc.theoKy && ky ? ky : null, dau]
    .filter(Boolean).join('_') + '.xlsx'
}

/**
 * Mốc đầu và cuối của một kỳ, để lọc cột `timestamptz`.
 *
 * Trả về mốc theo **giờ Việt Nam (+07:00)**, không phải UTC. Một khoản tiền về
 * lúc 3 giờ sáng ngày 1/9 giờ Việt Nam là 20 giờ ngày 31/8 giờ UTC — cắt kỳ
 * theo UTC là đẩy nó sang tháng 8. Kế toán đối chiếu theo lịch Việt Nam, nên
 * sổ quỹ tháng 9 mà thiếu đúng những giao dịch rạng sáng mùng 1 là kiểu sai
 * không ai soi ra cho tới lúc lệch số với ngân hàng.
 */
export function mocKy(ky: string): { tu: string; den: string } {
  const [nam, thang] = ky.split('-').map(Number)
  const sang = thang === 12 ? { n: nam + 1, t: 1 } : { n: nam, t: thang + 1 }
  const p = (v: number) => String(v).padStart(2, '0')
  return {
    tu: `${nam}-${p(thang)}-01T00:00:00+07:00`,
    den: `${sang.n}-${p(sang.t)}-01T00:00:00+07:00`,
  }
}
