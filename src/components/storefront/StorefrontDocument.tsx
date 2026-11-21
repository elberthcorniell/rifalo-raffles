import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'

export function StorefrontDocument({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background font-poppins">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" asChild className="mb-6 text-primary hover:text-primary/80">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Link>
        </Button>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 text-lg text-muted-foreground">{description}</p>
          ) : null}
        </header>
        {children}
      </main>
      <Footer />
    </div>
  )
}
