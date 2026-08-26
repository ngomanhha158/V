'use client'
import { useActionState } from 'react'
import { previewUnits, commitUnits, type PreviewState } from './actions'

const initial: PreviewState = { phase: 'idle' }

export function ImportForm({ buildingCodes }: { buildingCodes: string[] }) {
  const [preview, doPreview, previewing] = useActionState(previewUnits, initial)
  const [commit, doCommit, committing] = useActionState(commitUnits, initial)

  // Sau khi import xong thì trạng thái 'done' của commit đè lên preview.
  const state = commit.phase === 'done' || commit.phase === 'error' ? commit : preview

  if (state.phase === 'done') {
    return (
      <div className="space-y-3">
        <p className="rounded bg-green-100 p-3 text-green-900">
          Đã import {state.inserted} căn hộ.
        </p>
        <a href="/bql/import" className="underline">Import file khác</a>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <form action={doPreview} className="space-y-3">
        <input
          type="file" name="file" accept=".xlsx" required
          className="w-full rounded border p-3"
        />
        <button
          disabled={previewing}
          className="w-full rounded bg-neutral-900 p-3 text-white disabled:opacity-50"
        >
          {previewing ? 'Đang đọc file…' : 'Kiểm tra file'}
        </button>
        <p className="text-sm opacity-70">
          Cột bắt buộc: <b>Tòa</b>, <b>Mã căn</b>, <b>Tầng</b>. Không bắt buộc: Diện tích, Loại, Tình trạng.
          {buildingCodes.length > 0 && <> Tòa đã có: {buildingCodes.join(', ')}.</>}
        </p>
      </form>

      {state.phase === 'error' && (
        <p className="rounded bg-red-100 p-3 text-red-900">{state.message}</p>
      )}

      {state.phase === 'preview' && (
        <section className="space-y-3">
          <h2 className="font-medium">{state.fileName}</h2>
          <p className="text-sm">
            <b>{state.ok.length}</b> dòng hợp lệ
            {state.issues.length > 0 && <> · <b className="text-red-700">{state.issues.length}</b> lỗi</>}
            {state.skippedBlank > 0 && <> · {state.skippedBlank} dòng trống được bỏ qua</>}
          </p>

          {state.issues.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-100">
                  <tr>
                    <th className="p-2 text-left">Dòng</th>
                    <th className="p-2 text-left">Cột</th>
                    <th className="p-2 text-left">Vấn đề</th>
                  </tr>
                </thead>
                <tbody>
                  {state.issues.map((i, n) => (
                    <tr key={n} className="border-t">
                      <td className="p-2 tabular-nums">{i.row}</td>
                      <td className="p-2 opacity-70">{i.column}</td>
                      <td className="p-2">{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {state.ok.length > 0 && (
            <form action={doCommit}>
              <input type="hidden" name="payload" value={JSON.stringify(state.ok)} />
              <button
                disabled={committing}
                className="w-full rounded bg-neutral-900 p-3 text-white disabled:opacity-50"
              >
                {committing ? 'Đang import…' : `Import ${state.ok.length} căn hộ`}
              </button>
              {state.issues.length > 0 && (
                <p className="mt-2 text-sm opacity-70">
                  Chỉ import {state.ok.length} dòng hợp lệ. Sửa các dòng lỗi rồi tải lên lại phần còn thiếu.
                </p>
              )}
            </form>
          )}
        </section>
      )}
    </div>
  )
}
