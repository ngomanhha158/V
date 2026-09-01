'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SlaState = { error?: string; ok?: string }

const MUC = ['low', 'normal', 'high', 'urgent'] as const
type Muc = (typeof MUC)[number]
const laMuc = (v: string): v is Muc => (MUC as readonly string[]).includes(v)

const VAI = ['bql_manager', 'bql_staff', 'technician', 'security', 'bqt'] as const
type Vai = (typeof VAI)[number]
const laVai = (v: string): v is Vai => (VAI as readonly string[]).includes(v)

/** Người ta nghĩ bằng giờ, bảng lưu bằng phút. Quy đổi ở một chỗ duy nhất. */
const HE_SO: Record<string, number> = { phut: 1, gio: 60, ngay: 1440 }

function doiRaPhut(so: string, donVi: string): number | null {
  const n = Number(so.replace(/[.\s,]/g, ''))
  const he = HE_SO[donVi]
  if (!he || !Number.isFinite(n) || n <= 0) return null
  const phut = Math.round(n * he)
  // Trần 90 ngày: quá mức này gần như chắc chắn là gõ nhầm đơn vị, và một hạn
  // SLA ba tháng thì không còn là cam kết nữa.
  return Number.isSafeInteger(phut) && phut <= 129_600 ? phut : null
}

async function duAn() {
  const supabase = await createClient()
  const { data } = await supabase.from('projects').select('id').limit(1).maybeSingle()
  return { supabase, project: data?.id ?? null }
}

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '23505') {
    return 'Danh mục này đã có hạn cho mức ưu tiên đó rồi. Sửa dòng đang có, hoặc chọn mức ưu tiên khác.'
  }
  if (code === '42501') return 'Bạn không có quyền sửa SLA của dự án này.'
  return msg
}

function doc(formData: FormData) {
  const category = String(formData.get('category') ?? '').trim()
  const priority = String(formData.get('priority') ?? '')
  const escalate = String(formData.get('escalate_to') ?? '')
  const respond = doiRaPhut(String(formData.get('respond') ?? ''), String(formData.get('respond_dv') ?? ''))
  const resolve = doiRaPhut(String(formData.get('resolve') ?? ''), String(formData.get('resolve_dv') ?? ''))

  if (!category) return { loi: 'Chưa nhập tên danh mục sự cố.' }
  if (!laMuc(priority)) return { loi: 'Mức ưu tiên không hợp lệ.' }
  if (!laVai(escalate)) return { loi: 'Vai trò leo thang không hợp lệ.' }
  if (respond === null) return { loi: 'Hạn tiếp nhận phải là số dương, tối đa 90 ngày.' }
  if (resolve === null) return { loi: 'Hạn xử lý phải là số dương, tối đa 90 ngày.' }
  // Tiếp nhận muộn hơn xử lý là vô nghĩa, và cron leo thang sẽ báo động nhầm.
  if (respond > resolve) {
    return { loi: 'Hạn tiếp nhận phải sớm hơn hoặc bằng hạn xử lý.' }
  }
  return { category, priority, escalate, respond, resolve }
}

export async function themSla(_prev: SlaState, formData: FormData): Promise<SlaState> {
  const { supabase, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }
  const v = doc(formData)
  if ('loi' in v) return { error: v.loi }

  const { error } = await supabase.from('sla_policies').insert({
    project_id: project, category: v.category, priority: v.priority,
    respond_mins: v.respond, resolve_mins: v.resolve, escalate_to: v.escalate,
  })
  if (error) return { error: dichLoi(error.code, `Không thêm được: ${error.message}`) }

  revalidatePath('/bql/sla')
  revalidatePath('/bql/go-live')
  revalidatePath('/tickets/new')
  return { ok: `Đã thêm hạn cho "${v.category}". Cư dân chọn được danh mục này khi báo sự cố.` }
}

export async function suaSla(_prev: SlaState, formData: FormData): Promise<SlaState> {
  const { supabase, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu dòng cần sửa.' }
  const v = doc(formData)
  if ('loi' in v) return { error: v.loi }

  const { error } = await supabase.from('sla_policies')
    .update({
      category: v.category, priority: v.priority,
      respond_mins: v.respond, resolve_mins: v.resolve, escalate_to: v.escalate,
    })
    .eq('id', id).eq('project_id', project)
  if (error) return { error: dichLoi(error.code, `Không sửa được: ${error.message}`) }

  revalidatePath('/bql/sla')
  revalidatePath('/tickets/new')
  // Ticket đã tạo giữ nguyên hạn cũ: hạn được chốt vào lúc tạo, không tính lại.
  return { ok: `Đã cập nhật "${v.category}". Yêu cầu đang mở giữ nguyên hạn cũ; hạn mới áp cho yêu cầu tạo sau.` }
}

export async function xoaSla(_prev: SlaState, formData: FormData): Promise<SlaState> {
  const { supabase, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }
  const id = String(formData.get('id') ?? '')
  const ten = String(formData.get('ten') ?? '')
  if (!id) return { error: 'Thiếu dòng cần xóa.' }

  const { error } = await supabase.from('sla_policies')
    .delete().eq('id', id).eq('project_id', project)
  if (error) return { error: dichLoi(error.code, `Không xóa được: ${error.message}`) }

  revalidatePath('/bql/sla')
  revalidatePath('/bql/go-live')
  revalidatePath('/tickets/new')
  return { ok: `Đã xóa hạn "${ten}". Nếu đây là mức cuối của danh mục đó thì cư dân sẽ không còn chọn được nó.` }
}
