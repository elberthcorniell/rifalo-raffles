import { cn } from '@/lib/utils'

/** Visible wordmark inside public/rifalo_logo.png (the file is a square with black padding). */
const CONTENT = {
  top: 438 / 1254,
  height: (748 - 438) / 1254,
  left: 182 / 1254,
  width: (1118 - 182) / 1254,
}

export function PlatformLogo({
  className,
  height = 36,
}: {
  className?: string
  height?: number
}) {
  const imgSize = height / CONTENT.height

  return (
    <span
      className={cn('relative inline-block overflow-hidden', className)}
      style={{ height, width: imgSize * CONTENT.width }}
    >
      <img
        src="/rifalo_logo.png"
        alt="Rifalo"
        className="absolute max-w-none"
        style={{
          height: imgSize,
          width: imgSize,
          left: -(imgSize * CONTENT.left),
          top: -(imgSize * CONTENT.top),
        }}
      />
    </span>
  )
}
