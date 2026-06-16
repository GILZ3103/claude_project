import { useState } from 'react'

// Generic "broken image" placeholder (inline SVG, no network needed).
const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

/**
 * <img> wrapper that swaps to a neutral placeholder if the source fails to load.
 * Ported from KioskUI so missing/broken Unsplash URLs never show a broken icon.
 */
export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)
  const { src, alt, style, className, ...rest } = props

  if (didError) {
    return (
      <div
        className={`inline-flex items-center justify-center bg-gray-100 ${className ?? ''}`}
        style={style}
      >
        <img src={ERROR_IMG_SRC} alt={alt ?? 'Image unavailable'} {...rest} data-original-url={src} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={() => setDidError(true)}
      {...rest}
    />
  )
}

export default ImageWithFallback
