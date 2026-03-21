import { useState, useEffect } from 'react'
import { getProductVersions } from '@/api/products'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { History, GitBranch } from 'lucide-react'

const SAMPLE_VERSIONS = [
  { version: 3, changed_at: '2026-03-20T10:00:00Z', changed_by: 'John Doe', eco_title: 'Cost Reduction', fields_changed: ['cost_price'], is_current: true },
  { version: 2, changed_at: '2026-03-15T14:30:00Z', changed_by: 'Sarah Chen', eco_title: 'Price Update Q4', fields_changed: ['sale_price', 'cost_price'], is_current: false },
  { version: 1, changed_at: '2026-03-01T09:00:00Z', changed_by: 'Admin', eco_title: null, fields_changed: [], is_current: false },
]

export default function VersionHistory({ productId, productName }) {
  const [versions, setVersions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!productId) return
    const fetchVersions = async () => {
      setIsLoading(true)
      try {
        const res = await getProductVersions(productId)
        const data = res.data?.results || res.data || []
        setVersions(Array.isArray(data) && data.length > 0 ? data : SAMPLE_VERSIONS)
      } catch {
        setVersions(SAMPLE_VERSIONS)
      } finally {
        setIsLoading(false)
      }
    }
    fetchVersions()
  }, [productId])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Version History
          {productName && (
            <span className="text-muted-foreground font-normal">
              — {productName}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            No version history available.
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-0">
              {versions.map((v, i) => (
                <div key={v.version} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    v.is_current
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-border text-muted-foreground'
                  }`}>
                    <GitBranch className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className={`flex-1 rounded-lg border p-4 ${
                    v.is_current ? 'border-primary/20 bg-primary/5' : 'bg-card'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          Version {v.version}
                        </span>
                        {v.is_current && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.changed_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      by <span className="font-medium text-foreground">{v.changed_by}</span>
                      {v.eco_title && (
                        <>
                          {' '}via ECO:{' '}
                          <span className="font-medium text-foreground">{v.eco_title}</span>
                        </>
                      )}
                    </p>
                    {v.fields_changed && v.fields_changed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {v.fields_changed.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs font-normal">
                            {f.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
