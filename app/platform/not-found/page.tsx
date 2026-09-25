import Link from 'next/link'

export default function PlatformNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Página no encontrada</h1>
        <p className="text-muted-foreground mt-2">
          Esta ruta solo está disponible en el subdominio de tu organización.
        </p>
        <Link href="/" className="text-black font-semibold hover:underline mt-4 inline-block">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
