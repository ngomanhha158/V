/**
 * Căn hộ: nhãn tiếng Việt và một chỗ duy nhất đọc số diện tích người gõ.
 *
 * File này không phụ thuộc gì — màn thật, màn demo và test cùng dùng. Màn demo
 * KHÔNG được kéo theo server action nào, nên nhãn phải nằm ngoài form.tsx.
 */

export const TEN_LOAI: Record<string, string> = {
  apartment: 'Căn hộ',
  shophouse: 'Shophouse',
  office: 'Văn phòng',
  penthouse: 'Penthouse',
}

export const tenLoai = (v: string) => TEN_LOAI[v] ?? v

export const TEN_TINH_TRANG: Record<string, { nhan: string; tone: 'trung' | 'tot' | 'brand' }> = {
  vacant: { nhan: 'Chưa có người ở', tone: 'trung' },
  owner_occupied: { nhan: 'Chủ ở', tone: 'tot' },
  rented: { nhan: 'Cho thuê', tone: 'brand' },
}

/**
 * Trần diện tích một căn. Cột là numeric(8,2) nên chứa được tới tám chữ số,
 * nhưng một căn 10.000 m² thì không phải căn — đó là gõ nhầm đơn vị hoặc dán
 * nhầm cột. Chặn ở đây rẻ hơn nhiều so với phát nguyên tháng hóa đơn sai.
 */
export const DIEN_TICH_TOI_DA = 10_000

/**
 * Đọc số diện tích người gõ. Trả `null` nếu không đọc được — người gọi tự
 * quyết định báo lỗi thế nào.
 *
 * Nhận cả "78,5" lẫn "78.5": diện tích một căn không bao giờ tới hàng nghìn
 * nên không có chuyện dấu chấm là dấu phân nhóm. Nhận luôn đuôi "m2"/"m²" vì
 * người ta hay gõ theo khi chép từ bảng khác.
 *
 * Chỉ nhận tối đa hai chữ số thập phân, đúng bằng numeric(8,2) của cột. Nhận
 * nhiều hơn thì Postgres tự làm tròn im lặng, mà làm tròn im lặng một con số
 * dùng để tính tiền là thứ không ai phát hiện ra cho tới lúc đối chiếu.
 */
export function docDienTich(raw: string): number | null {
  const s = raw.replace(/\s+/g, '').replace(/(m²|m2)$/i, '')
  if (!/^\d+([.,]\d{1,2})?$/.test(s)) return null
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n > DIEN_TICH_TOI_DA) return null
  return n
}

/** Hiện diện tích theo lối viết Việt: 78,5 chứ không phải 78.5. */
export const soM2 = (n: number) => String(n).replace('.', ',')

/**
 * Lọc chuỗi tìm mã căn về đúng những ký tự mã căn có thật.
 *
 * PostgREST dịch `*` trong mẫu ilike thành `%`, và `%` `_` vốn đã là ký tự đại
 * diện của SQL. Người gõ "%" vào ô tìm mà nhận về toàn bộ 468 căn thì chỉ là
 * khó hiểu; nhưng cùng ô đó còn quyết định nút "áp diện tích cho N căn" đụng
 * vào những căn nào, nên một ký tự đại diện lọt qua là sửa nhầm dữ liệu thật.
 */
export const thoatMaCan = (s: string) => s.replace(/[^A-Za-z0-9.\-]/g, '')

// ─────────────────────── Bộ lọc màn căn hộ ───────────────────────

/**
 * Bộ lọc của màn căn hộ, đọc từ URL.
 *
 * Trang hiện danh sách và hành động "áp diện tích hàng loạt" phải lọc GIỐNG HỆT
 * nhau: nút trên màn ghi "áp cho 156 căn", và 156 đó phải đúng là những căn bị
 * sửa. Nên bộ lọc nằm ở một file, dạng dữ liệu, chứ không phải hai chuỗi
 * `.eq()` viết riêng ở hai nơi rồi hy vọng chúng không lệch nhau.
 */
export type Loc = {
  /** Mã tòa như người dùng thấy trên URL; '' nghĩa là mọi tòa. */
  toa: string
  /** id của tòa đó, null khi mã không có thật. */
  toaId: string | null
  /** id mọi tòa của dự án — mọi truy vấn đều khoanh trong đây. */
  toaTrongDuAn: string[]
  tang: number | null
  /** Chuỗi tìm mã căn, đã lọc sạch ký tự đại diện. */
  ma: string
  /** Chỉ những căn chưa có diện tích. */
  chuaCo: boolean
}

/** uuid không bao giờ tồn tại, dùng khi mã tòa trên URL không có thật. */
const TOA_KHONG_CO = '00000000-0000-0000-0000-000000000000'

export type ThamSo = { toa?: string; tang?: string; ma?: string; thieu?: string }

export function docLoc(sp: ThamSo, toaTheoMa: Map<string, string>): Loc {
  const toa = (sp.toa ?? '').trim().toUpperCase()
  const tangRaw = (sp.tang ?? '').trim()
  return {
    toa,
    toaId: toaTheoMa.get(toa) ?? null,
    toaTrongDuAn: [...toaTheoMa.values()],
    tang: /^\d{1,3}$/.test(tangRaw) ? Number(tangRaw) : null,
    ma: thoatMaCan((sp.ma ?? '').trim()),
    chuaCo: sp.thieu === '1',
  }
}

export function coLoc(loc: Loc): boolean {
  return Boolean(loc.toa) || loc.tang !== null || Boolean(loc.ma) || loc.chuaCo
}

/** Dựng lại query string từ bộ lọc, để link phân trang không làm rơi bộ lọc. */
export function queryLoc(loc: Loc, them: Record<string, string> = {}): string {
  const p = new URLSearchParams()
  if (loc.toa) p.set('toa', loc.toa)
  if (loc.tang !== null) p.set('tang', String(loc.tang))
  if (loc.ma) p.set('ma', loc.ma)
  if (loc.chuaCo) p.set('thieu', '1')
  for (const [k, v] of Object.entries(them)) v ? p.set(k, v) : p.delete(k)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export type DieuKien =
  /**
   * Khoanh vùng dự án. Policy `unit_read` cho đọc mọi căn của MỌI dự án
   * (`using (true)`), nên không có điều kiện này thì con số trên nút áp hàng
   * loạt đếm cả căn của khu khác — trong khi lệnh ghi lại bị RLS chặn đúng
   * những căn đó. Nút hứa một đằng, sửa một nẻo.
   */
  | { kieu: 'trongDuAn'; ids: string[] }
  | { kieu: 'toa'; gt: string }
  | { kieu: 'tang'; gt: number }
  | { kieu: 'ma'; mau: string }
  | { kieu: 'chuaCo' }

export function dieuKien(loc: Loc): DieuKien[] {
  const ds: DieuKien[] = [{ kieu: 'trongDuAn', ids: loc.toaTrongDuAn }]
  // Mã tòa không có thật thì khớp 0 căn. Bỏ hẳn điều kiện này đi thì bộ lọc
  // "tòa không tồn tại" lại trả về TOÀN BỘ căn của khu — và nút áp hàng loạt
  // sẽ đụng vào tất cả.
  if (loc.toa) ds.push({ kieu: 'toa', gt: loc.toaId ?? TOA_KHONG_CO })
  if (loc.tang !== null) ds.push({ kieu: 'tang', gt: loc.tang })
  if (loc.ma) ds.push({ kieu: 'ma', mau: `%${loc.ma}%` })
  if (loc.chuaCo) ds.push({ kieu: 'chuaCo' })
  return ds
}

/** Câu tả bộ lọc bằng tiếng người, để nút áp hàng loạt nói rõ nó đụng vào đâu. */
export function taLoc(loc: Loc): string {
  const v: string[] = []
  if (loc.toa) v.push(`tòa ${loc.toa}`)
  if (loc.tang !== null) v.push(`tầng ${loc.tang}`)
  if (loc.ma) v.push(`mã chứa "${loc.ma}"`)
  if (loc.chuaCo) v.push('chưa có diện tích')
  return v.length ? v.join(', ') : 'toàn bộ căn trong khu'
}
