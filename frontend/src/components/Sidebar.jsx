import { motion } from 'framer-motion'

const NAV = [
  { id: 'overview',  label: 'Overview' },
  { id: 'revenue',   label: 'Revenue' },
  { id: 'products',  label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'delivery',  label: 'Delivery' },
  { id: 'divider' },
  { id: 'workflow',  label: 'Pipeline Workflow' },
  { id: 'about',     label: 'About & Docs' },
]

const icons = {
  overview:  <GridIcon />,
  revenue:   <TrendIcon />,
  products:  <BoxIcon />,
  customers: <UserIcon />,
  delivery:  <TruckIcon />,
  workflow:  <FlowIcon />,
  about:     <InfoIcon />,
}

export default function Sidebar({ active, onSelect }) {
  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 16px',
        borderRight: '1px solid var(--shadow-dark)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ paddingLeft: 12, marginBottom: 40 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          Supply Chain
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Analytics Platform
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map((item, i) =>
          item.id === 'divider' ? (
            <div key="div" style={{ height: 1, background: 'var(--shadow-dark)', margin: '10px 4px' }} />
          ) : (
            <NavItem
              key={item.id}
              item={item}
              icon={icons[item.id]}
              active={active === item.id}
              onClick={() => onSelect(item.id)}
              delay={i * 0.05}
            />
          )
        )}
      </nav>

      {/* Bottom tag */}
      <div style={{ marginTop: 'auto', paddingLeft: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          DataCo Dataset<br />
          178k records · 2015–2017
        </div>
      </div>
    </motion.aside>
  )
}

function NavItem({ item, icon, active, onClick, delay }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: active ? 'var(--accent-dim)' : 'transparent',
        boxShadow: active ? 'var(--nm-inset)' : 'none',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        fontFamily: 'inherit',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        width: '100%',
      }}
      whileHover={{ x: active ? 0 : 4 }}
    >
      <span style={{ opacity: active ? 1 : 0.6, display: 'flex' }}>{icon}</span>
      {item.label}
    </motion.button>
  )
}

/* Inline SVG icons — clean, no dependencies */
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}
function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}
function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function TruckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}
function FlowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="4" rx="1"/><rect x="16" y="3" width="5" height="4" rx="1"/>
      <rect x="9" y="10" width="6" height="4" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/>
      <rect x="16" y="17" width="5" height="4" rx="1"/>
      <line x1="5.5" y1="7" x2="12" y2="10"/><line x1="18.5" y1="7" x2="12" y2="10"/>
      <line x1="12" y1="14" x2="5.5" y2="17"/><line x1="12" y1="14" x2="18.5" y2="17"/>
    </svg>
  )
}
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}
