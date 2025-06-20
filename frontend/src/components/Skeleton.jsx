import { motion } from 'framer-motion'

export default function Skeleton({ width = '100%', height = 20, radius = 8, style = {} }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--bg-dark), var(--shadow-light), var(--bg-dark))',
        backgroundSize: '200% 100%',
        ...style,
      }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="nm-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={12} width="50%" />
      <Skeleton height={32} width="70%" />
      <Skeleton height={12} width="40%" />
    </div>
  )
}
