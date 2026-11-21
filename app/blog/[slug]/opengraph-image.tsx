import { ImageResponse } from 'next/og'
import { getBlogPost, isBlogPostVisible } from '@/lib/blog'

export const runtime = 'nodejs'
export const alt = 'Blog de Rifalo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function BlogOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getBlogPost(slug)
  const title = post && isBlogPostVisible(post) ? post.h1 : 'Blog de Rifalo'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0B2447',
          color: '#ffffff',
          padding: '72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, background: '#FFD000', marginRight: 14 }} />
          <div style={{ fontSize: 28, letterSpacing: 3, color: '#FFD000' }}>RIFALO</div>
        </div>
        <div
          style={{
            fontSize: 52,
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: -1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.72)' }}>rifalo.do/blog</div>
      </div>
    ),
    { ...size },
  )
}
