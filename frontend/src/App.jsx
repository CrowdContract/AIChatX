import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Overview  from './pages/Overview'
import Revenue   from './pages/Revenue'
import Products  from './pages/Products'
import Customers from './pages/Customers'
import Delivery  from './pages/Delivery'
import Workflow  from './pages/Workflow'
import About     from './pages/About'

const PAGES = {
  overview:  { component: Overview,  title: 'Overview',                   subtitle: 'Business summary, KPIs, and strategic context',         exportTable: 'monthly_revenue' },
  revenue:   { component: Revenue,   title: 'Revenue Analysis',           subtitle: 'Monthly trends, profit, and growth rates',              exportTable: 'monthly_revenue' },
  products:  { component: Products,  title: 'Products & Categories',      subtitle: 'Top products by revenue, category breakdown',           exportTable: 'product_performance' },
  customers: { component: Customers, title: 'Customer Intelligence',      subtitle: 'CLV, segments, repeat rates, and top accounts',         exportTable: 'customer_segments' },
  delivery:  { component: Delivery,  title: 'Delivery Performance',       subtitle: 'Late delivery risk, shipping efficiency, delay analysis',exportTable: 'late_delivery_risk' },
  workflow:  { component: Workflow,  title: 'Pipeline Workflow',           subtitle: 'Medallion architecture, DAG, technology stack',         exportTable: null },
  about:     { component: About,     title: 'About & Documentation',      subtitle: 'Data dictionary, benchmarks, FAQ, and contact info',    exportTable: null },
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export default function App() {
  const [active, setActive] = useState('overview')
  const page = PAGES[active]
  const Page = page.component

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar active={active} onSelect={setActive} />

      <main style={{ flex: 1, overflowY: 'auto', padding: '36px 40px 60px', minWidth: 0 }}>

        {/* Page header */}
        <motion.div
          key={active + '-header'}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                {page.title}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{page.subtitle}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <ClassificationBadge />
              {page.exportTable && <ExportLink table={page.exportTable} />}
            </div>
          </div>
        </motion.div>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function ClassificationBadge() {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap',
      background: 'rgba(232,168,56,0.15)', color: 'var(--warning)',
    }}>
      INTERNAL ONLY
    </div>
  )
}

function ExportLink({ table }) {
  return (
    <motion.a
      href={`/api/export/${table}`}
      download
      className="nm-btn"
      whileTap={{ scale: 0.96 }}
      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export CSV
    </motion.a>
  )
}
