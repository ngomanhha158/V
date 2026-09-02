// Chạy TOÀN BỘ ngăn xếp Railway trên Postgres thật (PGlite/WASM in-memory):
// lớp tương thích, schema, seed, quyền, lớp đăng nhập tự viết, rồi hai bài
// smoke. Không cần Docker, không cần Railway. Dùng: npm run verify:railway
//
// Vì sao tách khỏi verify-schema.mjs chứ không gộp: hai bài chứng minh hai
// chuyện khác nhau và phải giữ được cả hai.
//   • verify-schema.mjs  — schema đứng ĐỘC LẬP, không cần auth.uid() thật.
//   • file này           — đúng thứ tự và đúng bộ quyền mà production chạy.
// Gộp lại thì mất bài thứ nhất, mà bài thứ nhất mới là thứ giữ cho schema.sql
// không lặng lẽ dính chặt vào một nhà cung cấp.
//
// Đây cũng là chỗ auth_hooks.sql lần đầu được chạy trong CI. Trước khi có
// 00_compat.sql thì không chạy được — nó cần schema auth và ba role của
// Supabase — nên danh sách grant dài dằng dặc trong đó chưa từng có ai kiểm.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Đúng thứ tự của railway/GD1-runbook.sh. Thứ tự KHÔNG phải chuyện thẩm mỹ:
// auth_hooks.sql thu hồi quyền nền rồi cấp lại, nên chạy nó trước schema là
// thu hồi trên những bảng chưa tồn tại.
const FILES = [
  'railway/00_compat.sql',
  'schema.sql',
  'seed.sql',
  'auth_hooks.sql',
  'railway/03_auth.sql',
  'railway/02_smoke_prod.sql',
  'railway/04_smoke_auth.sql',
]

/**
 * Dựng một database sạch rồi chạy hết danh sách file.
 * `doi` cho phép sửa nội dung một file trước khi áp — dùng cho phần canary bên
 * dưới. Trả về tên file đầu tiên bị đỏ, hoặc null nếu xanh hết.
 */
async function dungNgan(doi = (_f, s) => s, im = false) {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    for (const f of FILES) {
      try {
        await db.exec(doi(f, readFileSync(join(ROOT, f), 'utf8')))
        if (!im) console.log(`PASS  ${f}`)
      } catch (e) {
        if (!im) console.error(`FAIL  ${f}\n      ${e.message}`)
        return f    // file sau đứng trên file trước, chạy tiếp chỉ ra lỗi dây chuyền
      }
    }
    return null
  } finally {
    await db.close()
  }
}

/**
 * Canary — chứng minh hai bài smoke KHÔNG rỗng.
 *
 * Cả hai file smoke báo kết quả bằng RAISE NOTICE, mà PGlite không đưa notice
 * ra ngoài. Nên "PASS" ở trên chỉ nói được "chạy hết file mà không văng lỗi".
 * Một file smoke bị ai đó gỡ ruột cũng sẽ PASS y hệt, và từ đó về sau nó gác
 * một cánh cửa đã mở.
 *
 * Cách chặn: cố ý PHÁ hệ thống đúng một chỗ rồi bắt buộc bài smoke phải đỏ.
 * Nó đỏ nghĩa là những câu `if ... raise exception` bên trong có thật sự chạy.
 */
const CANARY = [
  {
    ten: 'bỏ SET ROLE authenticated (truy vấn chạy quyền cao, RLS không áp)',
    file: 'railway/02_smoke_prod.sql',
    doi: (s) => s.replace("  execute 'set local role authenticated';",
                          '  -- canary: co y bo dong nay'),
  },
  {
    ten: 'gỡ nền của service_role (webhook ngân hàng và job nền cùng chết)',
    file: 'railway/02_smoke_prod.sql',
    doi: (s) => `${s}\nrevoke all on all tables in schema public from service_role;\n`,
    ap: 'auth_hooks.sql',
  },
  {
    // Nửa còn lại của cùng một lỗi. Quyền BẢNG và quyền GỌI HÀM mất độc lập
    // với nhau, nên một canary không thay được canary kia.
    ten: 'gỡ EXECUTE của service_role (ghi_nhan_tien_ve và 5 hàm job nền)',
    file: 'railway/02_smoke_prod.sql',
    doi: (s) => `${s}\nrevoke execute on all functions in schema public from service_role;\n`,
    ap: 'auth_hooks.sql',
  },
  {
    ten: 'auth_huy_ma giết cả mã cũ người ta đang cầm',
    file: 'railway/04_smoke_auth.sql',
    doi: (s) => s.replace(
      "   where m.user_id = v_uid and m.dung_luc is null\n   order by m.tao_luc desc limit 1;",
      '   where m.user_id = v_uid and m.dung_luc is null;'),
    ap: 'railway/03_auth.sql',
  },
  {
    // Nếu chỉ đánh dấu "đã dùng" thay vì xóa, suất được trả lại nhưng hạn 60
    // giây vẫn tính — tức là câu trả lời sai với người dùng vẫn còn nguyên.
    ten: 'auth_huy_ma đánh dấu thay vì xóa (hạn 60 giây vẫn tính)',
    file: 'railway/04_smoke_auth.sql',
    doi: (s) => s.replace(
      '  delete from auth.ma_dang_nhap where id = v_id;',
      '  update auth.ma_dang_nhap set dung_luc = now() where id = v_id;'),
    ap: 'railway/03_auth.sql',
  },
  {
    ten: 'cấp lại EXECUTE auth_dat_mat_khau cho authenticated',
    file: 'railway/04_smoke_auth.sql',
    doi: (s) => `${s}\ngrant execute on function public.auth_dat_mat_khau(uuid, text) to authenticated;\n`,
    // Cấp ở CUỐI 03_auth.sql, tức là sau câu revoke — đúng kiểu sai mà người ta
    // hay mắc: thêm một dòng grant tiện tay ở cuối file.
    ap: 'railway/03_auth.sql',
  },
]

console.log('── Ngăn xếp Railway')
const do1 = await dungNgan()
let ok = do1 === null

if (ok) {
  console.log('\n── Canary (mỗi dòng dưới đây PHẢI đỏ, nếu xanh là bài smoke rỗng)')
  for (const c of CANARY) {
    const dich = c.ap ?? c.file
    const vo = await dungNgan((f, s) => (f === dich ? c.doi(s) : s), true)
    if (vo === c.file) {
      console.log(`OK    ${c.file} bắt được: ${c.ten}`)
    } else {
      console.error(`RỖNG  ${c.file} KHÔNG bắt được: ${c.ten}`
        + (vo ? ` (đỏ ở ${vo} thay vì ở đây)` : ' (cả ngăn xếp vẫn xanh)'))
      ok = false
    }
  }
}

process.exit(ok ? 0 : 1)
