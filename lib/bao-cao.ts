/**
 * Báo cáo BQT hàng quý — chữ nghĩa và phép tính dùng chung.
 *
 * Mọi TỶ LỆ ở đây tính từ hai con số ĐÃ ĐÓNG BĂNG trong báo cáo, không truy vấn
 * lại. Đó là cả điểm của tính năng: biên bản họp và báo cáo phải nói cùng một
 * con số mãi mãi. Tính lại ở tầng màn hình là mở đúng cánh cửa vừa đóng.
 */

export type BaoCao = {
  nam: number
  quy: number
  tu_ngay: string
  den_ngay: string
  hoa_don_phai_thu: number
  hoa_don_da_thu: number
  cong_no_cuoi_quy: number
  so_can: number
  so_can_no: number
  quy_bao_tri_dau: number
  quy_bao_tri_cuoi: number
  quy_chi_trong_quy: number
  chi_vat_tu: number
  so_yeu_cau: number
  so_yeu_cau_xong: number
  so_yeu_cau_dung_han: number
  so_danh_gia: number
  tong_diem: number
  so_thi_cong: number
  so_ban_giao_ca: number
  so_ban_giao_chua_ky: number
}

/** Làm tròn 1 chữ số — tỷ lệ báo cáo đọc bằng mắt, không cần hai chữ số lẻ. */
export function tyLe(phan: number, tong: number): number {
  if (!(tong > 0)) return 0
  return Math.round((1000 * phan) / tong) / 10
}

export function phanTram(n: number): string {
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

/** "Quý III/2026" — số La Mã, đúng lối biên bản họp. */
export const LA_MA = ['', 'I', 'II', 'III', 'IV'] as const
export function tenQuy(nam: number, quy: number): string {
  return `Quý ${LA_MA[quy] ?? quy}/${nam}`
}

export type Chi = {
  khoa: string
  nhan: string
  gia_tri: string
  phu?: string
  tone: 'tot' | 'canh' | 'xau' | 'trung'
}

/**
 * Bốn chỉ số BQT hỏi đầu tiên, kèm ngưỡng.
 *
 * Ngưỡng viết ra ở đây thay vì để người đọc tự đoán: 85% tỷ lệ thu là bình
 * thường ở một khu vận hành ổn, dưới 75% là có vấn đề về quy trình thu chứ
 * không phải vài hộ khó khăn.
 */
export function chiSoChinh(b: BaoCao): Chi[] {
  const thu = tyLe(b.hoa_don_da_thu, b.hoa_don_phai_thu)
  const sla = tyLe(b.so_yeu_cau_dung_han, b.so_yeu_cau_xong)
  const diem = b.so_danh_gia > 0 ? Math.round((10 * b.tong_diem) / b.so_danh_gia) / 10 : null
  return [
    {
      khoa: 'thu', nhan: 'Tỷ lệ thu', gia_tri: phanTram(thu),
      phu: `${vnd(b.hoa_don_da_thu)} / ${vnd(b.hoa_don_phai_thu)}`,
      tone: thu >= 85 ? 'tot' : thu >= 75 ? 'canh' : 'xau',
    },
    {
      khoa: 'sla', nhan: 'Yêu cầu đúng hạn', gia_tri: phanTram(sla),
      phu: `${b.so_yeu_cau_dung_han}/${b.so_yeu_cau_xong} việc đã xong · ${b.so_yeu_cau} việc tiếp nhận`,
      tone: sla >= 90 ? 'tot' : sla >= 75 ? 'canh' : 'xau',
    },
    {
      khoa: 'diem', nhan: 'Điểm hài lòng',
      gia_tri: diem == null ? '—' : `${String(diem).replace('.', ',')} / 5`,
      // Số phiếu ít thì điểm không nói lên gì, và màn hình phải nói ra điều đó
      // thay vì để BQT mang một con số ba phiếu ra họp.
      phu: b.so_danh_gia === 0
        ? 'Chưa có đánh giá nào'
        : b.so_danh_gia < 10
          ? `Chỉ ${b.so_danh_gia} phiếu — quá ít để kết luận`
          : `${b.so_danh_gia} phiếu`,
      tone: diem == null || b.so_danh_gia < 10 ? 'trung'
        : diem >= 4 ? 'tot' : diem >= 3 ? 'canh' : 'xau',
    },
    {
      khoa: 'quy', nhan: 'Chi từ quỹ bảo trì', gia_tri: vnd(b.quy_chi_trong_quy),
      phu: `Số dư cuối quý ${vnd(b.quy_bao_tri_cuoi)}`,
      tone: 'trung',
    },
  ]
}

function vnd(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`
}

/**
 * So với quý trước — một con số không có xu hướng thì khó hành động.
 *
 * So sánh giữa hai BẢN ĐÃ ĐÓNG BĂNG, nên nó ổn định: mở lại sau ba tháng vẫn ra
 * đúng mũi tên ấy.
 */
export function soVoiQuyTruoc(nay: BaoCao, truoc: BaoCao | null) {
  if (!truoc) return null
  const a = tyLe(nay.hoa_don_da_thu, nay.hoa_don_phai_thu)
  const b = tyLe(truoc.hoa_don_da_thu, truoc.hoa_don_phai_thu)
  const lech = Math.round((a - b) * 10) / 10
  return {
    truoc: tenQuy(truoc.nam, truoc.quy),
    ty_le_thu_truoc: b,
    lech,
    loi: lech === 0
      ? `Tỷ lệ thu bằng ${tenQuy(truoc.nam, truoc.quy)}.`
      : `Tỷ lệ thu ${lech > 0 ? 'tăng' : 'giảm'} ${phanTram(Math.abs(lech))} so với ${tenQuy(truoc.nam, truoc.quy)}.`,
  }
}

/** Quý liền trước, xử lý đúng chỗ bắc cầu sang năm. */
export function quyTruoc(nam: number, quy: number): { nam: number; quy: number } {
  return quy === 1 ? { nam: nam - 1, quy: 4 } : { nam, quy: quy - 1 }
}
