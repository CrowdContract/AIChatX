import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import ChartCard from '../components/ChartCard'
import ExportButton from '../components/ExportButton'
import { useApi, fmt } from '../hooks/useApi'

const COLORS = ['#4f6ef7','#7b94f8','#a8b8fa','#c4cffb','#dce3fd','#edf0fe','#4caf8a','#7dcfb0','#b8e8d8','#e8a838']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="nm-card-sm" style={{ minWidth: 150 }}>
      <div className="text-muted" style={{ marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{fmt.short(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Products() {
  const { data: topProducts, loading: prodLoading } = useApi('/products/top', { limit: 10 })
  const { data: categories, loading: catLoading } = useApi('/products/categories')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Narrative + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <motion.div
          className="nm-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ flex: 1, minWidth: 280 }}
        >
          <div className="section-title">Analysis</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            The top 10 products are concentrated in Sporting Goods and Electronics. Smart watch alone accounts for a disproportionate share of revenue. Category diversity is limited — the top 3 categories generate over 70% of total revenue.
          </p>
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 4 }}>
          <ExportButton table="product_performance" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top products bar chart */}
        <ChartCard title="Top 10 Products by Revenue">
          {prodLoading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="text-muted">Loading…</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--shadow-dark)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => fmt.short(v)} />
                <YAxis
                  type="category"
                  dataKey="product_name"
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  axisLine={false} tickLine={false}
                  width={120}
                  tickFormatter={v => v.length > 16 ? v.slice(0, 16) + '…' : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" name="Revenue" radius={[0,4,4,0]} maxBarSize={18}>
                  {topProducts?.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Categories bar chart */}
        <ChartCard title="Revenue by Category">
          {catLoading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="text-muted">Loading…</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={categories?.slice(0, 10)}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--shadow-dark)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => fmt.short(v)} />
                <YAxis
                  type="category"
                  dataKey="category_name"
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  axisLine={false} tickLine={false}
                  width={120}
                  tickFormatter={v => v.length > 16 ? v.slice(0, 16) + '…' : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" name="Revenue" radius={[0,4,4,0]} fill="#4caf8a" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Product table */}
      {topProducts && (
        <ChartCard title="Product Details">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  {['Product', 'Category', 'Revenue', 'Units Sold', 'Margin %', 'Avg Discount'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '4px 12px',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--text-muted)', letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProducts.map((row, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        {row.product_name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', color: 'var(--text-secondary)' }}>{row.category_name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', fontWeight: 600 }}>{fmt.currency(row.total_revenue)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{fmt.number(row.units_sold)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>
                      <span className={`badge ${row.avg_margin_pct >= 0 ? 'badge-up' : 'badge-down'}`}>
                        {Number(row.avg_margin_pct).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', color: 'var(--text-secondary)' }}>
                      {Number(row.avg_discount).toFixed(1)}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  )
}
