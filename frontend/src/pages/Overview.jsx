import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import ExportButton from '../components/ExportButton'
import { CardSkeleton } from '../components/Skeleton'
import { useApi, fmt } from '../hooks/useApi'

const COLORS = ['#4f6ef7', '#7b94f8', '#a8b8fa', '#4caf8a', '#e8a838', '#e05c5c']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="nm-card-sm" style={{ minWidth: 150 }}>
      <div className="text-muted" style={{ marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{fmt.short(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function AnomalyCallout({ item }) {
  const up = item.mom_revenue_growth_pct > 0
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        borderLeft: `3px solid ${up ? 'var(--success)' : 'var(--danger)'}`,
        paddingLeft: 10,
        marginBottom: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: up ? 'var(--success)' : 'var(--danger)' }}>
        {item.period} — {up ? '+' : ''}{Number(item.mom_revenue_growth_pct).toFixed(1)}% MoM
      </div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
        {up
          ? 'Significant revenue spike. Possible seasonal demand or promotional activity.'
          : 'Sharp revenue drop. Possible supply disruption or demand contraction.'
        }
      </div>
    </motion.div>
  )
}

export default function Overview() {
  const { data: kpis,      loading: kpiLoading }      = useApi('/kpis')
  const { data: monthly,   loading: monthlyLoading }   = useApi('/revenue/monthly')
  const { data: markets,   loading: marketsLoading }   = useApi('/market/by-region')
  const { data: anomalies }                             = useApi('/anomalies')
  const { data: benchmarks }                            = useApi('/benchmarks')
  const { data: meta }                                  = useApi('/meta')

  const [selYear, setSelYear] = useState('all')
  const { data: years } = useApi('/revenue/years')

  const filteredMonthly = monthly
    ? (selYear === 'all' ? monthly : monthly.filter(r => r.order_year === Number(selYear)))
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Metadata strip ──────────────────────────────────────────────── */}
      {meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <MetaChip label="Source"    value={meta.source} />
          <MetaChip label="Refreshed" value={meta.last_refresh} />
          <MetaChip label="Records"   value={fmt.number(meta.record_count)} />
          <MetaChip label="Range"     value={meta.date_range} />
          <MetaChip label="Pipeline"  value={meta.architecture} />
        </motion.div>
      )}

      {/* ── Business context banner ──────────────────────────────────────── */}
      <NarrativeCard
        problem="This dashboard addresses a core operational question: is the supply chain generating profitable growth while maintaining acceptable delivery reliability across global markets?"
        conclusion={kpis
          ? `Revenue reached ${fmt.short(kpis.total_revenue)} with a ${kpis.profit_margin}% margin across ${fmt.number(kpis.total_orders)} orders. However, ${kpis.late_pct}% late delivery rate exceeds the 30% industry benchmark — the primary area requiring intervention.`
          : null
        }
        recommendations={[
          'Renegotiate Standard Class SLA with logistics partners to reduce late rate below 30%.',
          'Focus customer retention investment on Consumer segment — highest repeat purchase rate.',
          'Investigate the Fitness department for margin improvement; highest revenue but inconsistent profit ratio.',
        ]}
      />

      {/* ── Year filter ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="text-muted" style={{ fontSize: 12 }}>Year</span>
        {['all', ...(years ?? [])].map(y => (
          <button
            key={y}
            className={`nm-btn${selYear === String(y) ? ' active' : ''}`}
            onClick={() => setSelYear(String(y))}
          >
            {y === 'all' ? 'All years' : y}
          </button>
        ))}
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 20 }}>
        {kpiLoading
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : kpis && <>
              <KpiCard
                label="Total Revenue" value={fmt.short(kpis.total_revenue)}
                sub="all markets" benchmark={benchmarks ? null : null}
                delay={0}
              />
              <KpiCard
                label="Total Orders" value={fmt.number(kpis.total_orders)}
                sub="unique orders" delay={0.07}
              />
              <KpiCard
                label="Avg Order Value" value={fmt.currency(kpis.avg_order_value)}
                benchmark={benchmarks?.target_aov}
                benchmarkLabel={`Target $${benchmarks?.target_aov}`}
                trend={kpis.avg_order_value >= (benchmarks?.target_aov ?? 500) ? 10 : -5}
                delay={0.14}
              />
              <KpiCard
                label="Profit Margin" value={fmt.pct(kpis.profit_margin)}
                benchmark={benchmarks?.target_profit_margin}
                benchmarkLabel={`Target ${benchmarks?.target_profit_margin}%`}
                trend={kpis.profit_margin - (benchmarks?.target_profit_margin ?? 15)}
                delay={0.21}
              />
              <KpiCard
                label="Customers" value={fmt.number(kpis.total_customers)}
                sub="unique" delay={0.28}
              />
              <KpiCard
                label="Late Deliveries" value={fmt.pct(kpis.late_pct)}
                sub="of shipments"
                trend={-(kpis.late_pct - (benchmarks?.target_late_pct ?? 30))}
                benchmarkLabel={`Target <${benchmarks?.target_late_pct}%`}
                status={kpis.late_pct > (benchmarks?.target_late_pct ?? 30) ? 'danger' : 'ok'}
                delay={0.35}
              />
            </>
        }
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

        <ChartCard title="Monthly Revenue & Profit">
          {monthlyLoading ? <ChartPlaceholder /> : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={filteredMonthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f6ef7" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4f6ef7" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4caf8a" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4caf8a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--shadow-dark)" vertical={false} />
                  <XAxis dataKey="order_month_name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => fmt.short(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Target reference line */}
                  <ReferenceLine
                    y={1000000} stroke="var(--warning)" strokeDasharray="4 4" strokeWidth={1}
                    label={{ value: 'Target $1M', position: 'right', fontSize: 10, fill: 'var(--warning)' }}
                  />
                  <Area type="monotone" dataKey="total_revenue" name="Revenue" stroke="#4f6ef7" strokeWidth={2} fill="url(#gRev)" dot={false} />
                  <Area type="monotone" dataKey="total_profit"  name="Profit"  stroke="#4caf8a" strokeWidth={2} fill="url(#gProfit)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="text-muted" style={{ fontSize: 11 }}>
                Dashed line = $1M monthly revenue target. Revenue mostly above target; profit tracks at ~10% margin.
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Market">
          {marketsLoading ? <ChartPlaceholder /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={markets} dataKey="total_revenue" nameKey="market"
                    cx="50%" cy="50%" innerRadius={44} outerRadius={72}
                    paddingAngle={3} strokeWidth={0}
                  >
                    {markets?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {markets?.map((m, i) => (
                  <div key={m.market} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span className="text-secondary" style={{ flex: 1, fontSize: 12 }}>{m.market}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt.short(m.total_revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── Anomaly callouts ─────────────────────────────────────────────── */}
      {anomalies?.length > 0 && (
        <ChartCard title="Detected Anomalies">
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Months with revenue growth more than 1.8 standard deviations from the mean.
          </div>
          {anomalies.map((a, i) => <AnomalyCallout key={i} item={a} />)}
        </ChartCard>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaChip({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <span className="text-muted" style={{ fontSize: 11 }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

function NarrativeCard({ problem, conclusion, recommendations }) {
  return (
    <motion.div
      className="nm-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}
    >
      <div>
        <div className="section-title">The Problem</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{problem}</p>
      </div>
      <div>
        <div className="section-title">The Conclusion</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {conclusion ?? <span className="text-muted">Loading analysis…</span>}
        </p>
      </div>
      <div>
        <div className="section-title">Recommendations</div>
        <ol style={{ paddingLeft: 16, margin: 0 }}>
          {recommendations.map((r, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>
              {r}
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  )
}

function ChartPlaceholder() {
  return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="text-muted">Loading…</span>
    </div>
  )
}
