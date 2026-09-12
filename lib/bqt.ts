/**
 * Khu vực Ban quản trị — số liệu để GIÁM SÁT, không phải để vận hành.
 *
 * BQT do hội nghị nhà chung cư bầu ra, nhiệm vụ là giám sát đơn vị quản lý
 * (BQL) và đồng ký quỹ bảo trì 2%. Họ không trực ban, không gạch công nợ,
 * không xếp ca. Trước file này, một thành viên BQT đăng nhập vào là rơi thẳng
 * vào bảng điều khiển vận hành ba mươi mục của chính bên mà họ phải giám sát —
 * vừa không dùng được, vừa sai vai.
 *
 * Ba phép tính ở đây đều là phép tính DỄ LÀM SAI theo hướng có lợi cho bên bị
 * giám sát, nên chúng nằm ở một chỗ có test chứ không nằm rải trong JSX.
 */

import { homNayVN } from './ky.ts'
// soDuTaiNgay sống ở lib/quy.ts cùng phần còn lại của nghiệp vụ quỹ. Chép lại
// một bản thứ hai ở đây là dựng đúng cái chỗ lệch mà cả thay đổi này đi bịt.
import { soDuTaiNgay, type DongLuyKe } from './quy.ts'

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Ngày cuối của tháng m (1-12). Ngày 0 của tháng sau = ngày cuối tháng này. */
const cuoiThang = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

export type Ky = { tu: string; den: string; nhan: string }

/**
 * Quý chứa ngày đó. BQT làm việc theo quý — báo cáo quý, kỳ họp — nên mốc mặc
 * định của màn này là quý, không phải tháng như các màn vận hành.
 */
export function quyChua(ngay: string): Ky {
  const [y, m] = ngay.split('-').map(Number)
  const q = Math.ceil(m / 3)
  const dauThang = (q - 1) * 3 + 1
  const cuoiQuy = q * 3
  return {
    tu: iso(y, dauThang, 1),
    den: iso(y, cuoiQuy, cuoiThang(y, cuoiQuy)),
    nhan: `Quý ${q}/${y}`,
  }
}

/** Quý liền trước. Lùi một ngày khỏi mốc đầu quý là rơi vào quý trước. */
export function quyTruoc(k: Ky): Ky {
  const [y, m] = k.tu.split('-').map(Number)
  const ty = m === 1 ? y - 1 : y
  const tm = m === 1 ? 12 : m - 1
  return quyChua(iso(ty, tm, 1))
}

export function quyHomNay(): Ky {
  return quyChua(homNayVN())
}

export type TinhQuy =
  /** Chưa từng đối chiếu với sao kê ngân hàng. */
  | 'chua_doi_chieu'
  /** Sổ và ngân hàng lệch nhau tại chính ngày đối chiếu. */
  | 'lech'
  /** Khớp, nhưng lần đối chiếu gần nhất đã quá cũ. */
  | 'cu'
  | 'khop'

/**
 * Hạn để một lần đối chiếu còn nói lên điều gì.
 *
 * Sao kê ngân hàng về hằng tháng, nên 45 ngày là đã trượt mất một kỳ. Để rộng
 * hơn thì "đã đối chiếu" trở thành một dấu tick vĩnh viễn, mà quỹ bảo trì là
 * khoản tiền lớn nhất BQT chịu trách nhiệm.
 */
export const HAN_DOI_CHIEU_NGAY = 45

export type KetQuaSoatQuy = {
  tinh: TinhQuy
  /** Số dư sổ hôm nay. */
  soDuSo: number
  /** Số dư sổ TẠI ngày đối chiếu — con số phải đem so với sao kê. */
  soDuLucDoiChieu: number | null
  /** Sổ trừ ngân hàng, tại ngày đối chiếu. Dương = sổ nhiều hơn ngân hàng. */
  lech: number | null
  soNgayCach: number | null
}

/**
 * Đối chiếu sổ quỹ với sao kê.
 *
 * BẪY CHÍNH: `so_du_ngan_hang` là ẢNH CHỤP tại `doi_chieu_ngay`, không phải số
 * dư hôm nay. Đem nó so với số dư sổ HÔM NAY là so hai mốc thời gian khác nhau
 * — mỗi khoản thu chi sau ngày đối chiếu sẽ hiện ra thành một khoản "lệch"
 * không có thật, và màn hình kêu oan mỗi ngày cho tới lần đối chiếu sau. Nên
 * phép so đúng là: số dư sổ TẠI ngày đó, đối chiếu với sao kê ngày đó.
 *
 * Lệch xét trước cũ: một lần đối chiếu cũ mà đã lệch thì cái lệch mới là việc
 * phải làm ngay, còn cũ chỉ là phải làm lại.
 */
export function soatQuy(
  so: DongLuyKe[],
  soDuNganHang: number | null,
  doiChieuNgay: string | null,
  homNay: string = homNayVN(),
): KetQuaSoatQuy {
  const soDuSo = soDuTaiNgay(so, homNay)
  if (doiChieuNgay === null || soDuNganHang === null) {
    return { tinh: 'chua_doi_chieu', soDuSo, soDuLucDoiChieu: null, lech: null, soNgayCach: null }
  }
  const soDuLucDoiChieu = soDuTaiNgay(so, doiChieuNgay)
  const lech = soDuLucDoiChieu - soDuNganHang
  const soNgayCach = Math.round(
    (Date.parse(`${homNay}T00:00:00Z`) - Date.parse(`${doiChieuNgay}T00:00:00Z`)) / 86_400_000)
  const tinh: TinhQuy = lech !== 0 ? 'lech' : soNgayCach > HAN_DOI_CHIEU_NGAY ? 'cu' : 'khop'
  return { tinh, soDuSo, soDuLucDoiChieu, lech, soNgayCach }
}

/** Đúng phần của bql_dashboard mà phép soát vùng mù cần. */
export type SoTicket = {
  tong_ticket: number
  ticket_tu_choi: number
  ticket_khong_co_sla: number
  ticket_co_ket_luan: number
  ty_le_dung_sla: number | null
}

/**
 * Ngưỡng mà tỷ lệ đúng SLA thôi không còn nói lên điều gì.
 *
 * Một phần tư số yêu cầu nằm ngoài phép đo là đủ để con số dẫn đường sai: 95%
 * đúng hạn trên ba phần tư số việc không phải là 95%.
 */
export const NGUONG_VUNG_MU = 0.25

export type VungMu = {
  /** Yêu cầu không nằm trong phép đo SLA: bị từ chối, hoặc danh mục chưa khai SLA. */
  soNgoai: number
  tyLe: number
  /** Tỷ lệ đúng SLA có còn đáng tin không. */
  dangNgai: boolean
}

/**
 * Phần yêu cầu KHÔNG nằm trong phép đo SLA.
 *
 * Đây là con số mà một ban giám sát cần thấy cạnh tỷ lệ đúng hạn, vì nó chính
 * là hai cách làm đẹp tỷ lệ đó mà không cần chạy nhanh hơn: từ chối bớt yêu
 * cầu, và để danh mục không khai SLA. Cả hai đều hợp lệ ở mức lẻ tẻ, nên vấn
 * đề không phải là có hay không mà là BAO NHIÊU — và chỉ tỷ lệ mới trả lời
 * được.
 *
 * Yêu cầu còn trong hạn, chưa ngã ngũ thì KHÔNG tính là vùng mù: nó chưa được
 * đo chứ không phải không đo được.
 */
export function vungMuSla(d: SoTicket): VungMu {
  const soNgoai = d.ticket_tu_choi + d.ticket_khong_co_sla
  const tyLe = d.tong_ticket > 0 ? soNgoai / d.tong_ticket : 0
  return { soNgoai, tyLe, dangNgai: d.tong_ticket > 0 && tyLe >= NGUONG_VUNG_MU }
}

/**
 * Điểm hài lòng có đủ mẫu để nói không.
 *
 * 5,0 sao từ hai lượt đánh giá trên hai trăm yêu cầu không phải là điểm 5,0.
 * Hiện con số mà không hiện cỡ mẫu là mời người đọc kết luận từ hư không.
 */
export const TOI_THIEU_DANH_GIA = 10

export function duMauDanhGia(soLuot: number): boolean {
  return soLuot >= TOI_THIEU_DANH_GIA
}
