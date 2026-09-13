/**
 * Đọc mã nguồn để soát bằng test.
 *
 * Một số luật của repo này không gọi hàm nào ra mà kiểm được: "mọi màn hỏi
 * is_staff phải đi qua quyen()", "vỏ điều hướng phải mang no-print", "bản demo
 * phải dùng chung component với bản thật". Chúng chỉ soát được bằng cách đọc
 * chính file nguồn.
 *
 * Cái bẫy đi kèm đã gặp BA lần trong một tuần: luật quét theo chuỗi bắt đúng
 * phần CHÚ THÍCH giải thích luật đó. Lần đầu ở bài soát cron, lần hai ở
 * chot-quyen.ts (docblock trích dẫn nguyên kiểu viết sai để dạy), lần ba ở màn
 * hóa đơn (một comment nhắc tới dòng "Còn phải trả"). Cả ba lần cách chữa sai
 * là nới luật cho nó thôi kêu — nới xong thì mất luôn luật. Cách chữa đúng là
 * loại chú thích ra, và viết nó MỘT LẦN ở đây.
 */
import { readFileSync, readdirSync } from 'node:fs'

const GOC = new URL('../', import.meta.url)

export const docNguon = (duong: string) => readFileSync(new URL(duong, GOC), 'utf8')

/**
 * Vị trí `i` có nằm TRONG một chú thích không.
 *
 * Không hỏi "dòng này có bắt đầu bằng dấu chú thích không" — bản đầu hỏi đúng
 * câu đó và trượt ngay. Một chú thích nhiều dòng trong JSX có dòng đầu mở bằng
 * dấu ngoặc nhọn rồi dấu mở chú thích, nhưng những dòng SAU thì bắt đầu bằng
 * chữ thường như mã bình thường. Nên phải quét từ đầu file và nhớ mình đang ở
 * trong hay ngoài, chứ không đoán theo từng dòng.
 *
 * Không tách chuỗi ra khỏi mã: một literal chứa đúng hai ký tự mở chú thích sẽ
 * bị tính nhầm. Chấp nhận được cho một bài soát nguồn, và sai về phía IM LẶNG
 * — tức là bỏ sót, không phải kêu oan.
 */
export function trongChuThich(src: string, i: number): boolean {
  let j = 0
  while (j < i) {
    if (src.startsWith('//', j)) {
      const het = src.indexOf('\n', j)
      if (het === -1 || het > i) return true
      j = het + 1
      continue
    }
    if (src.startsWith('/*', j)) {
      const het = src.indexOf('*/', j + 2)
      if (het === -1 || het + 2 > i) return true
      j = het + 2
      continue
    }
    if (src.startsWith('--', j)) {          // SQL
      const het = src.indexOf('\n', j)
      if (het === -1 || het > i) return true
      j = het + 1
      continue
    }
    j += 1
  }
  return false
}

/**
 * Tìm một chuỗi trong mã THẬT, bỏ qua mọi lần nó xuất hiện trong chú thích.
 * Trả về số lần khớp thật.
 */
export function demNgoaiChuThich(src: string, can: string): number {
  let n = 0
  for (let i = src.indexOf(can); i !== -1; i = src.indexOf(can, i + 1)) {
    if (!trongChuThich(src, i)) n += 1
  }
  return n
}

/** Mọi file .ts/.tsx dưới các thư mục đã cho, đường dẫn tương đối gốc repo. */
export function tepNguon(...goc: string[]): string[] {
  const ra: string[] = []
  for (const g of goc) {
    for (const m of readdirSync(new URL(`${g}/`, GOC), { recursive: true, encoding: 'utf8' })) {
      if (m.endsWith('.ts') || m.endsWith('.tsx')) ra.push(`${g}/${m}`)
    }
  }
  return ra
}
