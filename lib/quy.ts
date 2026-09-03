/**
 * Quỹ bảo trì 2% — phần chữ nghĩa dùng chung giữa màn cư dân và màn BQL.
 *
 * Cả tính năng này dựng lên để cư dân NHÌN THẤY tiền của mình, nên hai màn phải
 * đọc ra cùng một câu. Màn BQL nói "khớp" mà màn cư dân nói "lệch" thì cuộc họp
 * nhà chung cư bắt đầu bằng việc cãi nhau xem màn nào đúng.
 */

export const NHAN_LOAI: Record<string, string> = {
  so_du_dau: 'Số dư đầu kỳ',
  thu: 'Thu 2%',
  lai: 'Lãi ngân hàng',
  chi: 'Chi từ quỹ',
  dieu_chinh: 'Điều chỉnh',
}

export const nhanLoai = (l: string) => NHAN_LOAI[l] ?? l

/**
 * Tiền có dấu. Dùng dấu trừ thật (U+2212) chứ không phải gạch nối: trong một
 * bảng đầy gạch nối và gạch ngang, một khoản chi 96 triệu mang dấu gạch nối
 * trông như một ô để trống nối với ô bên cạnh.
 */
export function tienCoDau(n: number): string {
  const s = Math.abs(n).toLocaleString('vi-VN') + 'đ'
  if (n > 0) return '+' + s
  if (n < 0) return '−' + s
  return s
}

const NGAY = 86_400_000
/** Quá hạn này mà chưa đối chiếu lại thì con số của ngân hàng đã cũ. */
export const HAN_DOI_CHIEU = 45

/**
 * Sổ tự nói sổ đúng thì không chứng minh gì cả. Con số duy nhất chứng minh quỹ
 * còn nguyên là con số ngân hàng báo — nên trạng thái đối chiếu là thứ hiện to
 * nhất trên màn, không phải số dư.
 */
export function loiDoiChieu(a: {
  soSach: number
  soNganHang: number | null
  ngay: string | null
  homNay?: Date
}) {
  if (a.soNganHang == null || !a.ngay) {
    return {
      muc: 'canh' as const,
      tieu: 'Chưa từng đối chiếu với ngân hàng',
      than:
        'Số dư dưới đây là do sổ tự cộng. Chưa có con số nào của ngân hàng để so, ' +
        'nên nó chưa chứng minh được quỹ còn nguyên bao nhiêu.',
    }
  }

  const lech = a.soSach - a.soNganHang
  const tuoi = Math.floor(
    ((a.homNay ?? new Date()).getTime() - new Date(a.ngay + 'T00:00:00Z').getTime()) / NGAY,
  )

  if (lech !== 0) {
    const huong = lech > 0 ? 'nhiều hơn' : 'ít hơn'
    return {
      muc: 'xau' as const,
      tieu: 'SỔ VÀ NGÂN HÀNG KHÔNG KHỚP',
      than:
        `Sổ ghi ${huong} ngân hàng ${Math.abs(lech).toLocaleString('vi-VN')}đ. ` +
        'Một trong hai bên thiếu bút toán: hoặc có khoản đã chi mà chưa vào sổ, ' +
        'hoặc có khoản vào sổ mà tiền chưa ra khỏi tài khoản. Tìm ra trước khi họp BQT.',
    }
  }

  if (tuoi > HAN_DOI_CHIEU) {
    return {
      muc: 'canh' as const,
      tieu: `Khớp, nhưng số liệu ngân hàng đã ${tuoi} ngày`,
      than:
        `Lần đối chiếu gần nhất là ${tuoi} ngày trước. Khớp ở thời điểm đó không ` +
        'nói gì về hôm nay — lấy sao kê mới rồi cập nhật lại.',
    }
  }

  return {
    muc: 'tot' as const,
    tieu: 'Sổ khớp ngân hàng',
    than: `Đối chiếu ${tuoi === 0 ? 'hôm nay' : `${tuoi} ngày trước`}, hai bên cùng một con số.`,
  }
}
