import { Skeleton } from '@arco-design/web-react'

function PageSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      {/* Header area: title + subtitle */}
      <Skeleton
        loading
        animation
        text={{ rows: 2, widths: [240, 160] }}
        style={{ marginBottom: 24 }}
      />

      {/* Toolbar area: button placeholders */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Skeleton loading animation text={{ rows: 1, widths: [88] }} />
        <Skeleton loading animation text={{ rows: 1, widths: [88] }} />
        <Skeleton loading animation text={{ rows: 1, widths: [88] }} />
      </div>

      {/* Table area: multiple row skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          loading
          animation
          text={{ rows: 1, widths: ['100%'] }}
          style={{ marginBottom: 16 }}
        />
      ))}
    </div>
  )
}

export default PageSkeleton
