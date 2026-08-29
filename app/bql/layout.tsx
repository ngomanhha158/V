import { BqlShell } from '@/components/shell/bql-shell'

export default function BqlLayout({ children }: { children: React.ReactNode }) {
  return <BqlShell>{children}</BqlShell>
}
