/**
 * Bộ công cụ. Tách khỏi index.ts để test được mà không phải dựng stdio.
 *
 * Tên công cụ đều mang tiền tố `vbuilding_`: MCP server này sẽ chạy CẠNH những
 * server khác (ILMS, GitHub…), mà `tim_yeu_cau` trần thì trùng tên là chuyện
 * sớm muộn — và lúc trùng thì mô hình gọi nhầm hệ thống, không báo lỗi gì.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Client } from '../lib/db/postgrest.ts'
import {
  duMauDanhGia, quyHomNay, soatQuy, viecKyHop, vungMuSla, type Ky,
} from '../lib/bqt.ts'

type Khu = { id: string; name: string }
type Cong = {
  moKetNoi: () => Client
  chonKhu: (db: Client, ten?: string) => Promise<Khu>
}

/** Bọc mọi lỗi thành câu người đọc làm được gì với nó, thay vì ném stack. */
function traLoi(noiDung: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(noiDung, null, 2) }] }
}
function traLoiLoi(cau: string) {
  return { isError: true, content: [{ type: 'text' as const, text: cau }] }
}

/** Chạy một việc, đổi mọi lỗi thành câu chữ. */
async function chay<T>(viec: () => Promise<T>) {
  try {
    return traLoi(await viec())
  } catch (e) {
    return traLoiLoi(e instanceof Error ? e.message : String(e))
  }
}

/** Lỗi PostgREST → câu nói được phải làm gì. */
function loiDb(ten: string, e: { code?: string; message?: string } | null): never {
  const ma = e?.code ?? ''
  if (ma === 'PGRST301' || /jws|jwt|expired/i.test(e?.message ?? '')) {
    throw new Error(
      `Token hết hạn hoặc không hợp lệ. Phát token mới trên Railway: `
      + `npx tsx scripts/tao-token-mcp.ts <email>`,
    )
  }
  if (ma === '42501' || ma === 'PGRST116') {
    throw new Error(
      `Tài khoản này không có quyền với ${ten}. Trên web cũng sẽ không xem được — `
      + `đây là RLS chặn, không phải lỗi MCP.`,
    )
  }
  throw new Error(`${ten} hỏng: ${ma} ${e?.message ?? ''}`.trim())
}

const KHU = z.string().optional().describe(
  'Tên khu (khớp một phần cũng được). Bỏ trống nếu chỉ quản lý một khu.',
)

export function dangKyCongCu(server: McpServer, c: Cong) {
  const mo = async (khu?: string) => {
    const db = c.moKetNoi()
    return { db, khu: await c.chonKhu(db, khu) }
  }

  // ── ĐỌC ────────────────────────────────────────────────────────────────

  server.registerTool('vbuilding_danh_sach_khu', {
    title: 'Danh sách khu đang quản lý',
    description: 'Liệt kê các khu dân cư tài khoản này quản lý, kèm id và tên. '
      + 'Gọi trước khi dùng công cụ khác nếu chưa biết tên khu.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => chay(async () => {
    const db = c.moKetNoi()
    const { data, error } = await db.from('projects').select('id, name').order('name')
    if (error) loiDb('danh sách khu', error)
    return { khu: data ?? [] }
  }))

  server.registerTool('vbuilding_tong_quan', {
    title: 'Sức khỏe vận hành',
    description: 'Số liệu tổng quan một khu trong khoảng thời gian: tỷ lệ đúng hạn SLA, '
      + 'thời gian xử lý, công nợ, yêu cầu đang mở và quá hạn, tiền thu trong kỳ.',
    inputSchema: {
      khu: KHU,
      tu: z.string().optional().describe('Ngày bắt đầu, dạng YYYY-MM-DD. Bỏ trống = mặc định của hệ thống.'),
      den: z.string().optional().describe('Ngày kết thúc, dạng YYYY-MM-DD.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu, tu, den }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const { data, error } = await db.rpc('bql_dashboard', { p_project: k.id, p_tu: tu, p_den: den })
    if (error) loiDb('bql_dashboard', error)
    return { khu: k.name, so_lieu: data }
  }))

  server.registerTool('vbuilding_bao_cao_bqt', {
    title: 'Báo cáo kỳ họp Ban quản trị',
    description: 'Số liệu giám sát một kỳ + DANH SÁCH VIỆC phải đưa ra kỳ họp Ban quản trị. '
      + 'Dùng khi soạn báo cáo hoặc bộ slide trình trước kỳ họp. Trả về đúng những câu mà '
      + 'màn /bqt hiện, nên slide và màn hình không nói khác nhau.',
    inputSchema: {
      khu: KHU,
      tu: z.string().optional().describe('Ngày bắt đầu kỳ, dạng YYYY-MM-DD. Bỏ trống = quý này.'),
      den: z.string().optional().describe('Ngày kết thúc kỳ, dạng YYYY-MM-DD.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu, tu, den }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const ky: Ky = tu && den ? { tu, den, nhan: `${tu} – ${den}` } : quyHomNay()

    const [tong, so, quy] = await Promise.all([
      db.rpc('bql_dashboard', { p_project: k.id, p_tu: ky.tu, p_den: ky.den }),
      db.rpc('quy_so_ke_toan', { p_project: k.id }),
      db.from('quy_bao_tri')
        .select('ngan_hang, so_tai_khoan, so_du_ngan_hang, doi_chieu_ngay')
        .eq('project_id', k.id).maybeSingle(),
    ])
    // Không nuốt lỗi thành số 0: một báo cáo toàn số 0 vì truy vấn hỏng trông
    // y hệt một khu vận hành sạch sẽ, mà đây là tờ giấy đem ra trước kỳ họp.
    if (tong.error) loiDb('bql_dashboard', tong.error)
    if (so.error) loiDb('quy_so_ke_toan', so.error)
    if (quy.error) loiDb('quy_bao_tri', quy.error)
    const t = tong.data?.[0]
    if (!t) throw new Error(`Khu ${k.name} chưa có số liệu cho kỳ ${ky.nhan}.`)

    const sq = soatQuy(so.data ?? [], quy.data?.so_du_ngan_hang ?? null,
      quy.data?.doi_chieu_ngay ?? null)
    const mu = vungMuSla(t)
    return {
      khu: k.name,
      ky: { tu: ky.tu, den: ky.den, nhan: ky.nhan },
      // Việc phải chất vấn ĐỨNG TRƯỚC số liệu, cùng thứ tự màn /bqt dùng: ban
      // quản trị họp mỗi quý một lần, và thứ họ cần trước tiên là câu hỏi.
      viec_ky_hop: viecKyHop({
        quy: sq,
        doiChieuNgay: quy.data?.doi_chieu_ngay ?? null,
        mu,
        sla: t,
        congNoQuaHan: t.cong_no_qua_han,
        soCanNo: t.so_can_no,
      }),
      quy_bao_tri: {
        tinh: sq.tinh, so_du_so: sq.soDuSo, so_du_luc_doi_chieu: sq.soDuLucDoiChieu,
        lech: sq.lech, so_ngay_cach: sq.soNgayCach,
        ngan_hang: quy.data?.ngan_hang ?? null, doi_chieu_ngay: quy.data?.doi_chieu_ngay ?? null,
      },
      sla: {
        ty_le_dung_han: t.ty_le_dung_sla,
        // Tỷ lệ đúng hạn KHÔNG đứng một mình: 95% trên ba phần tư số việc thì
        // không phải 95%, và đó là con số dễ đem lên slide nhất.
        ngoai_phep_do: mu.soNgoai, ty_le_ngoai: mu.tyLe, dang_ngai: mu.dangNgai,
      },
      danh_gia: { so_luot: t.so_luot_danh_gia, du_mau: duMauDanhGia(t.so_luot_danh_gia) },
      so_lieu: t,
    }
  }))

  server.registerTool('vbuilding_cong_no', {
    title: 'Công nợ theo căn',
    description: 'Danh sách căn hộ còn nợ phí: mã căn, số tiền còn phải trả, số ngày quá hạn, '
      + 'số kỳ chưa đóng, kèm tên và liên lạc của chủ hộ (email + điện thoại). '
      + 'Dùng để trả lời "ai chưa đóng tiền", và để soạn thư nhắc nợ cho từng căn.',
    inputSchema: { khu: KHU },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const { data, error } = await db.rpc('bql_debt_report', { p_project: k.id })
    if (error) loiDb('bql_debt_report', error)
    return { khu: k.name, so_can: (data ?? []).length, cong_no: data ?? [] }
  }))

  server.registerTool('vbuilding_ton_kho', {
    title: 'Tồn kho vật tư',
    description: 'Số lượng còn lại của từng mặt hàng trong kho vật tư của khu.',
    inputSchema: { khu: KHU },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const { data, error } = await db.rpc('ton_kho', { p_project: k.id })
    if (error) loiDb('ton_kho', error)
    return { khu: k.name, ton_kho: data ?? [] }
  }))

  server.registerTool('vbuilding_kien_dang_giu', {
    title: 'Kiện hàng đang giữ hộ',
    description: 'Các kiện hàng lễ tân đang giữ hộ cư dân, chưa giao. Kèm căn hộ, '
      + 'đơn vị vận chuyển, vị trí để và số ngày đã giữ.',
    inputSchema: { khu: KHU },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const { data, error } = await db.rpc('kien_dang_giu', { p_project: k.id })
    if (error) loiDb('kien_dang_giu', error)
    return { khu: k.name, so_kien: (data ?? []).length, kien: data ?? [] }
  }))

  server.registerTool('vbuilding_so_ra_vao', {
    title: 'Sổ ra vào của khách',
    description: 'Lượt khách ra vào trong khoảng ngày. Cả hai mốc ngày đều bắt buộc — '
      + 'sổ này dài, đọc không giới hạn là kéo về hàng nghìn dòng không ai đọc.',
    inputSchema: {
      khu: KHU,
      tu: z.string().describe('Ngày bắt đầu, dạng YYYY-MM-DD.'),
      den: z.string().describe('Ngày kết thúc, dạng YYYY-MM-DD.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu, tu, den }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const { data, error } = await db.rpc('so_ra_vao', { p_project: k.id, p_tu: tu, p_den: den })
    if (error) loiDb('so_ra_vao', error)
    return { khu: k.name, tu, den, so_luot: (data ?? []).length, luot: data ?? [] }
  }))

  server.registerTool('vbuilding_tim_yeu_cau', {
    title: 'Tìm yêu cầu sửa chữa',
    description: 'Danh sách yêu cầu (ticket) của khu, lọc theo trạng thái. '
      + 'Mặc định trả về yêu cầu chưa đóng, mới nhất trước.',
    inputSchema: {
      khu: KHU,
      trang_thai: z.enum(['dang_mo', 'tat_ca']).optional()
        .describe('dang_mo (mặc định) = chưa đóng. tat_ca = kể cả đã đóng.'),
      gioi_han: z.number().int().min(1).max(100).optional()
        .describe('Số dòng tối đa, mặc định 30.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ khu, trang_thai, gioi_han }) => chay(async () => {
    const { db, khu: k } = await mo(khu)
    const n = gioi_han ?? 30
    let q = db.from('tickets')
      .select('id, title, category, priority, status, created_at, sla_due_at, units(code)')
      .eq('project_id', k.id)
      .order('created_at', { ascending: false })
      .limit(n)
    if ((trang_thai ?? 'dang_mo') === 'dang_mo') q = q.not('status', 'in', '("done","cancelled")')
    const { data, error } = await q
    if (error) loiDb('tickets', error)
    const ds = data ?? []
    // has_more: nói thẳng là còn nữa, đừng để người đọc tưởng đây là tất cả.
    return { khu: k.name, tra_ve: ds.length, con_nua: ds.length === n, yeu_cau: ds }
  }))

  // ── GHI (chỉ vận hành, không đụng tiền) ────────────────────────────────

  server.registerTool('vbuilding_tao_yeu_cau', {
    title: 'Tạo yêu cầu sửa chữa',
    description: 'Mở một yêu cầu mới cho một căn hộ. Dùng khi cư dân báo hỏng qua điện thoại '
      + 'hoặc tại quầy. KHÔNG dùng để ghi việc đã làm xong.',
    inputSchema: {
      can_ho: z.string().describe('Mã căn hộ, ví dụ "P1-10.01".'),
      tieu_de: z.string().min(3).describe('Một câu ngắn tả sự việc, ví dụ "Vòi nước bếp rò".'),
      hang_muc: z.string().describe('Nhóm sự việc: dien, nuoc, thang-may, ve-sinh, an-ninh, khac.'),
      muc_do: z.enum(['low', 'normal', 'high', 'urgent']).describe('Mức ưu tiên.'),
      mo_ta: z.string().optional().describe('Chi tiết thêm, nếu có.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ can_ho, tieu_de, hang_muc, muc_do, mo_ta }) => chay(async () => {
    const db = c.moKetNoi()
    const { data: u, error: eu } = await db.from('units').select('id, code').eq('code', can_ho).maybeSingle()
    if (eu) loiDb('units', eu)
    if (!u) throw new Error(`Không có căn nào mã "${can_ho}". Kiểm tra lại mã căn.`)
    const { data, error } = await db.rpc('create_ticket', {
      p_unit: u.id, p_title: tieu_de, p_category: hang_muc, p_priority: muc_do, p_description: mo_ta,
    })
    if (error) loiDb('create_ticket', error)
    return { da_tao: true, ticket: data, can_ho: u.code }
  }))

  server.registerTool('vbuilding_nhan_kien_hang', {
    title: 'Ghi nhận kiện hàng giữ hộ',
    description: 'Ghi một kiện hàng vừa nhận giữ hộ cho căn hộ. Cư dân sẽ thấy trên app.',
    inputSchema: {
      can_ho: z.string().describe('Mã căn hộ, ví dụ "P1-10.01".'),
      don_vi: z.string().optional().describe('Đơn vị vận chuyển, ví dụ "GHTK".'),
      ma_van_don: z.string().optional().describe('Mã vận đơn, nếu có.'),
      vi_tri: z.string().optional().describe('Để ở đâu, ví dụ "kệ B2".'),
      ghi_chu: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ can_ho, don_vi, ma_van_don, vi_tri, ghi_chu }) => chay(async () => {
    const db = c.moKetNoi()
    const { data: u, error: eu } = await db.from('units').select('id, code').eq('code', can_ho).maybeSingle()
    if (eu) loiDb('units', eu)
    if (!u) throw new Error(`Không có căn nào mã "${can_ho}". Kiểm tra lại mã căn.`)
    const { data, error } = await db.rpc('nhan_kien_hang', {
      p_unit: u.id, p_nha_van_chuyen: don_vi, p_ma_van_don: ma_van_don,
      p_vi_tri: vi_tri, p_ghi_chu: ghi_chu,
    })
    if (error) loiDb('nhan_kien_hang', error)
    return { da_ghi: true, kien: data, can_ho: u.code }
  }))

  server.registerTool('vbuilding_giao_kien_hang', {
    title: 'Ghi nhận đã giao kiện hàng',
    description: 'Đánh dấu một kiện hàng đã giao cho người nhận. Lấy id kiện từ '
      + 'vbuilding_kien_dang_giu.',
    inputSchema: {
      kien: z.string().describe('id của kiện hàng (uuid), lấy từ vbuilding_kien_dang_giu.'),
      nguoi_nhan: z.string().describe('Tên người tới nhận.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ kien, nguoi_nhan }) => chay(async () => {
    const db = c.moKetNoi()
    const { error } = await db.rpc('giao_kien_hang', { p_kien: kien, p_nguoi: nguoi_nhan })
    if (error) loiDb('giao_kien_hang', error)
    return { da_giao: true, kien, nguoi_nhan }
  }))
}
