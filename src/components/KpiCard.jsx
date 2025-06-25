import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * KpiCard — neumorphic metric card with optional:
 *  - trend arrow + badge (positive / negative)
 *  - benchmark label + thin progress bar
 *  - status override (danger / ok)
 *  - hover tooltip
 *  - sub-label
 */
export default function KpiCard({
  label,
  value,
  sub,
  trend,
  benchmarkLabel,
  status,       // 'ok' | 'danger' | 'warn' | undefined
  tooltip,
  delay = 0,
}) {
  const [hovered, setHovered] = useState(false)
  const isPositive = trend === undefined ? null : Number(trend) >= 0

  const trendColor =
    status === 'danger' ? 'var(--danger)'
    : status === 'warn'   ? 'var(--warning)'
    : isPositive === true  ? 'var(--success)'
    : isPositive === false ? 'var(--danger)'
    : 'var(--text-muted)'

  return (
    <motion.div
      className="nm-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, position: 'relative', cursor: tooltip ? 'help' : 'default' }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="section-title" style={{ marginBottom: 0 }}>{label}</span>
        {tooltip && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        )}
      </div>

      {/* Value */}
      <motion.span
        className="value-large"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.15 }}
        style={{ color: status === 'danger' ? 'var(--danger)' : 'var(--text-primary)' }}
      >
        {value}
      </motion.span>

      {/* Trend + sub */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {trend !== undefined && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600, color: trendColor,
          }}>
            {/* Arrow */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              {isPositive
                ? <polyline points="18 15 12 9 6 15" />
                : <polyline points="6 9 12 15 18 9" />
              }
            </svg>
            {isPositive ? '+' : ''}{Math.abs(Number(trend)).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>

      {/* Benchmark label */}
      {benchmarkLabel && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--shadow-dark)', paddingTop: 6 }}>
          {benchmarkLabel}
        </div>
      )}

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
              background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--nm-raised-sm)',
              padding: '8px 12px', fontSize: 12,
              color: 'var(--text-secondary)', lineHeight: 1.5,
              zIndex: 100, width: 200, pointerEvents: 'none',
            }}
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
