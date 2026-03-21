import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEcoDiff, getEco, getEcoChanges } from '@/api/ecos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageHeader from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ArrowLeft, ArrowRight, Minus, Plus, Equal, Diff } from 'lucide-react'

function ChangeIndicator({ type }) {
  if (type === 'add') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Added</Badge>
  if (type === 'remove') return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Removed</Badge>
  if (type === 'modify') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Modified</Badge>
  return null
}

export default function EcoComparison() {
  const { ecoId } = useParams()
  const navigate = useNavigate()

  const [eco, setEco] = useState(null)
  const [diff, setDiff] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('components')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ecoRes, diffRes] = await Promise.allSettled([
        getEco(ecoId),
        getEcoDiff(ecoId),
      ])

      if (ecoRes.status === 'fulfilled' && ecoRes.value.data) {
        setEco(ecoRes.value.data)
      } else {
        setEco(null)
      }

      if (diffRes.status === 'fulfilled' && diffRes.value.data) {
        setDiff(diffRes.value.data)
      } else {
        setDiff(null)
      }
    } catch (error) {
      console.error('Failed to fetch ECO comparison:', error)
      setEco(null)
      setDiff(null)
    } finally {
      setIsLoading(false)
    }
  }, [ecoId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const isProduct = diff?.type === 'product'
  const isBom = diff?.type === 'bom'

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground -ml-2"
        onClick={() => navigate(`/ecos/${ecoId}/detail`)}
      >
        <ArrowLeft className="h-4 w-4" /> Back to ECO Detail
      </Button>

      <PageHeader
        title="Change Comparison"
        description={eco ? `${eco.title} — ${eco.product_name}` : 'ECO Diff View'}
      >
        {eco && <StatusBadge status={eco.status} />}
      </PageHeader>

      {/* Summary Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>{' '}
              <span className="font-medium">{isProduct ? 'Product Change' : isBom ? 'BoM Change' : '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Target:</span>{' '}
              <span className="font-medium">{diff?.product_name}</span>
            </div>
            {isProduct && diff?.old_version && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">v{diff.old_version}</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="default">v{diff.new_version}</Badge>
              </div>
            )}
            {isBom && diff?.bom_version && (
              <div>
                <span className="text-muted-foreground">Version:</span>{' '}
                <span className="font-medium">{diff.bom_version}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Diff */}
      {isProduct && diff?.fields && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Diff className="h-4 w-4" /> Field-by-Field Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-48">Field</TableHead>
                    <TableHead className="bg-red-50/50 dark:bg-red-950/10">
                      <div className="flex items-center gap-1.5">
                        <Minus className="h-3.5 w-3.5 text-red-500" />
                        Before (v{diff.old_version})
                      </div>
                    </TableHead>
                    <TableHead className="bg-emerald-50/50 dark:bg-emerald-950/10">
                      <div className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-emerald-500" />
                        After (v{diff.new_version})
                      </div>
                    </TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.fields.map((f) => (
                    <TableRow key={f.field} className={f.changed ? 'bg-amber-50/30 dark:bg-amber-950/5' : ''}>
                      <TableCell className="font-medium">{f.label}</TableCell>
                      <TableCell className={`${f.changed ? 'text-red-600 line-through' : 'text-muted-foreground'}`}>
                        {f.old}
                      </TableCell>
                      <TableCell className={`${f.changed ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}`}>
                        {f.new}
                      </TableCell>
                      <TableCell>
                        {f.changed ? (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                            Changed
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Equal className="h-3 w-3" /> Same
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BoM Diff */}
      {isBom && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>

          <TabsContent value="components">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Diff className="h-4 w-4" /> Component Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!diff?.components || diff.components.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">No component changes.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead className="text-center bg-red-50/50 dark:bg-red-950/10">Old Qty</TableHead>
                          <TableHead className="text-center bg-emerald-50/50 dark:bg-emerald-950/10">New Qty</TableHead>
                          <TableHead className="text-center">Delta</TableHead>
                          <TableHead>Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diff.components.map((c, i) => {
                          const delta = (c.new_qty || 0) - (c.old_qty || 0)
                          return (
                            <TableRow key={i} className={
                              c.change === 'add' ? 'bg-emerald-50/30 dark:bg-emerald-950/5' :
                                c.change === 'remove' ? 'bg-red-50/30 dark:bg-red-950/5' :
                                  delta !== 0 ? 'bg-amber-50/30 dark:bg-amber-950/5' : ''
                            }>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className={`text-center ${c.change === 'add' ? 'text-muted-foreground' : ''}`}>
                                {c.old_qty ?? '—'}
                              </TableCell>
                              <TableCell className={`text-center ${c.change === 'remove' ? 'text-muted-foreground' : ''}`}>
                                {c.new_qty ?? '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                {delta > 0 ? (
                                  <span className="text-emerald-600 font-semibold">+{delta}</span>
                                ) : delta < 0 ? (
                                  <span className="text-red-600 font-semibold">{delta}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <ChangeIndicator type={c.change} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Diff className="h-4 w-4" /> Operation Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!diff?.operations || diff.operations.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">No operation changes.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operation</TableHead>
                          <TableHead className="bg-red-50/50 dark:bg-red-950/10">Old Duration</TableHead>
                          <TableHead className="bg-emerald-50/50 dark:bg-emerald-950/10">New Duration</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diff.operations.map((op, i) => (
                          <TableRow key={i} className={op.changed ? 'bg-amber-50/30 dark:bg-amber-950/5' : ''}>
                            <TableCell className="font-medium">{op.name}</TableCell>
                            <TableCell className={op.changed ? 'text-red-600 line-through' : 'text-muted-foreground'}>
                              {op.old_duration}
                            </TableCell>
                            <TableCell className={op.changed ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}>
                              {op.new_duration}
                            </TableCell>
                            <TableCell>
                              {op.changed ? (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Changed</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Equal className="h-3 w-3" /> Same
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="outline" onClick={() => navigate(`/ecos/${ecoId}/detail`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to ECO
        </Button>
        <Button variant="outline" onClick={() => navigate('/ecos')}>
          All ECOs
        </Button>
      </div>
    </div>
  )
}
