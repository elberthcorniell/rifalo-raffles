import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogChrome } from '@/components/blog/BlogChrome'
import { PLATFORM } from '@/lib/constants'
import { blogUnsubscribeSecret, verifyBlogUnsubscribeToken } from '@/lib/blog-unsubscribe'

export const metadata: Metadata = {
  title: 'Dejar de recibir correos',
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; listo?: string; error?: string }>
}) {
  const query = await searchParams
  if (query.error === '1') {
    return (
      <BlogChrome>
        <main className="mx-auto max-w-lg px-4 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">No se pudo guardar</h1>
          <p className="mt-3 text-[#4b5563]">
            Inténtalo de nuevo en un momento, o escribe a {PLATFORM.email}.
          </p>
        </main>
      </BlogChrome>
    )
  }
  if (query.listo === '1') {
    return (
      <BlogChrome>
        <main className="mx-auto max-w-lg px-4 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">Listo</h1>
          <p className="mt-3 text-[#4b5563]">No te enviaremos más correos del blog.</p>
          <Link href="/" className="mt-6 inline-block font-semibold hover:underline">
            Volver a Rifalo
          </Link>
        </main>
      </BlogChrome>
    )
  }

  const secret = blogUnsubscribeSecret()
  const email = query.token && secret ? verifyBlogUnsubscribeToken(query.token, secret) : null
  if (!email || !query.token) {
    return (
      <BlogChrome>
        <main className="mx-auto max-w-lg px-4 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">Enlace no válido</h1>
          <p className="mt-3 text-[#4b5563]">
            Este enlace no sirve. Si quieres darte de baja, escribe a {PLATFORM.email}.
          </p>
        </main>
      </BlogChrome>
    )
  }

  return (
    <BlogChrome>
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Dejar de recibir correos</h1>
        <p className="mt-3 text-[#4b5563]">
          Esto aplica a <span className="text-[#111111]">{email}</span>. No afecta los correos de una compra.
        </p>
        <form action="/api/blog/unsubscribe" method="post" className="mt-6">
          <input type="hidden" name="token" value={query.token} />
          <input type="hidden" name="web" value="1" />
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#111111] px-5 text-base font-semibold text-white sm:w-auto"
          >
            Confirmar baja
          </button>
        </form>
      </main>
    </BlogChrome>
  )
}
