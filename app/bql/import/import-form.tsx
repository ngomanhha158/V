'use client'
import { useActionState } from 'react'
import { previewUnits, commitUnits, type PreviewState } from './actions'
import {
  Bang, Button, Card, CardHead, Hop, LinkButton, Stat, Td, Th, Tr, cx,
} from '@/components/ui'
import { IcNhap, IcXong } from '@/components/icons'

const initial: PreviewState = { phase: 'idle' }

export function ImportForm({ buildingCodes }: { buildingCodes: string[] }) {
  const [preview, doPreview, previewing] = useActionState(previewUnits, initial)
  const [commit, doCommit, committing] = useActionState(commitUnits, initial)

  // Sau khi import xong thì trạng thái 'done' của commit đè lên preview.
  const state = commit.phase === 'done' || commit.phase === 'error' ? commit : preview

  if (state.phase === 'done') {
    return (
      <Card>
        <div className="space-y-4 p-6 text-center">
          <span className="inline-grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
            <IcXong width={26} height={26} />
          </span>
          <div>
            <p className="text-base font-semibold text-ink">
              Đã import {state.inserted} căn hộ
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Dữ liệu đã vào hệ thống và cư dân xin gia nhập được ngay.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <LinkButton href="/bql/import" co="sm">Import file khác</LinkButton>
            <LinkButton href="/bql" dang="chinh" co="sm">Về quản lý tòa</LinkButton>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHead
          title="Chọn file Excel"
          sub="File được đọc và kiểm tra trước, không ghi gì cho tới khi bạn xác nhận"
        />
        <form action={doPreview} className="space-y-3 p-4">
          <input
            type="file" name="file" accept=".xlsx" required
            className={cx(
              'w-full rounded-ctl border border-dashed border-line-firm bg-raised p-3',
              'text-[0.8125rem] text-muted',
              'file:mr-3 file:rounded-ctl file:border file:border-line-firm file:bg-surface',
              'file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink',
              'hover:file:bg-sunken',
            )}
          />
          <Button type="submit" dang="chinh" disabled={previewing}>
            <IcNhap width={15} height={15} />
            {previewing ? 'Đang đọc file…' : 'Kiểm tra file'}
          </Button>
          <div className="text-[0.8125rem] leading-relaxed text-muted">
            Cột bắt buộc: <b className="text-ink">Tòa</b>, <b className="text-ink">Mã căn</b>,{' '}
            <b className="text-ink">Tầng</b>. Không bắt buộc: Diện tích, Loại, Tình trạng.
            {buildingCodes.length > 0 && (
              <> Tòa đã có: <span className="text-ink">{buildingCodes.join(', ')}</span>.</>
            )}
          </div>
        </form>
      </Card>

      {state.phase === 'error' && (
        <Hop tone="xau" title="Không đọc được file">{state.message}</Hop>
      )}

      {state.phase === 'preview' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat nhan="Dòng hợp lệ" so={state.ok.length} tone={state.ok.length ? 'tot' : 'trung'} />
            <Stat
              nhan="Dòng lỗi" so={state.issues.length}
              tone={state.issues.length ? 'xau' : 'tot'}
            />
            <Stat nhan="Dòng trống bỏ qua" so={state.skippedBlank} />
          </div>

          {state.issues.length > 0 && (
            <Card>
              <CardHead
                title="Các dòng có vấn đề"
                sub={`${state.fileName} — sửa trong Excel rồi tải lên lại phần còn thiếu`}
              />
              <div className="max-h-72 overflow-y-auto">
                <Bang>
                  <thead className="sticky top-0 z-10">
                    <tr><Th>Dòng</Th><Th>Cột</Th><Th>Vấn đề</Th></tr>
                  </thead>
                  <tbody>
                    {state.issues.map((i, n) => (
                      <Tr key={n}>
                        <Td so className="font-medium text-ink">{i.row}</Td>
                        <Td className="text-muted">{i.column}</Td>
                        <Td className="text-bad">{i.message}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Bang>
              </div>
            </Card>
          )}

          {state.ok.length > 0 && (
            <Card>
              <form action={doCommit} className="space-y-3 p-4">
                <input type="hidden" name="payload" value={JSON.stringify(state.ok)} />
                {state.issues.length > 0 && (
                  <Hop tone="canh" title="Chỉ import phần hợp lệ">
                    {state.ok.length} dòng sẽ được ghi, {state.issues.length} dòng lỗi bị bỏ qua.
                    Sửa file rồi tải lên lại phần còn thiếu.
                  </Hop>
                )}
                <Button type="submit" dang="chinh" disabled={committing} className="w-full">
                  {committing ? 'Đang import…' : `Import ${state.ok.length} căn hộ`}
                </Button>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
