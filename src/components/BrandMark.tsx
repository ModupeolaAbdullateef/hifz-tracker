/** The open-book glyph from public/favicon.svg, without its own background — for sitting directly on the header gradient. */
export default function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M32 21.9C28.6 19 21.9 18.1 15.5 19.7V46c6.4-1.6 13.1-.7 16.5 2 3.4-2.7 10.1-3.6 16.5-2V19.7C41.9 18.1 35.2 19 32 21.9Z"
        fill="#ffffff"
      />
      <path d="M32 22v24.6" stroke="#3D2170" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}
