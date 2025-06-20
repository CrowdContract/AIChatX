import { motion } from 'framer-motion'

export default function ChartCard({ title, children, style = {} }) {
  return (
    <motion.div
      className="nm-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20, ...style }}
    >
      {title && (
        <span className="section-title" style={{ marginBottom: 0 }}>{title}</span>
      )}
      {children}
    </motion.div>
  )
}
