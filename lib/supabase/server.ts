import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const store = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          // ponytail: Server Component không set được cookie -> nuốt lỗi ở đây là ĐÚNG,
          // middleware đã refresh session rồi. Chỉ chỗ này mới được nuốt.
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
