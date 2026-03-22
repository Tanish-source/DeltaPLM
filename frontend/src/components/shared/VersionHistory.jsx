import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProductVersions, rollbackProductVersion } from '@/api/products'
import { getBomVersions, rollbackBomVersion } from '@/api/boms'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, GitBranch, RotateCcw } from 'lucide-react'
import { ROLES } from '@/lib/constants'

export default function VersionHistory({ recordId, recordName, recordType = 'product' }) {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [versions, setVersions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [rollbackLoadingId, setRollbackLoadingId] = useState(null)
  const canRollback = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])

  const fetchVersions = async () => {
    if (!recordId) return

    setIsLoading(true)
    try {
      const res = recordType === 'bom'
        ? await getBomVersions(recordId)
        : await getProductVersions(recordId)
      const data = res.data?.results || res.data || []
      setVersions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch version history:', error)
      setVersions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!recordId) return

    fetchVersions()
  }, [recordId, recordType])

  const handleRollback = async (targetId) => {
    setRollbackLoadingId(targetId)
    try {
      let response
      if (recordType === 'bom') {
        response = await rollbackBomVersion(recordId, targetId)
      } else {
        response = await rollbackProductVersion(recordId, targetId)
      }
      const newId = response?.data?.id
      if (newId) {
        navigate(recordType === 'bom' ? `/boms/${newId}` : `/products/${newId}`)
        return
      }
      await fetchVersions()
    } catch (error) {
      console.error('Failed to rollback version:', error)
    } finally {
      setRollbackLoadingId(null)
    }
  }

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
          {recordName && (
            <span className="text-muted-foreground font-normal">
              - {recordName}
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
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-0">
              {versions.map((version) => (
                <div key={version.id || version.version} className="relative flex gap-4 pb-6 last:pb-0">
                  <div
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                      version.is_current
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-background border-border text-muted-foreground'
                    }`}
                  >
                    <GitBranch className="h-4 w-4" />
                  </div>

                  <div
                    className={`flex-1 rounded-lg border p-4 ${
                      version.is_current ? 'border-primary/20 bg-primary/5' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">Version {version.version}</span>
                        {version.reference && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {version.reference}
                          </Badge>
                        )}
                        {version.is_current && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.changed_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      by <span className="font-medium text-foreground">{version.changed_by}</span>
                      {version.eco_title && (
                        <>
                          {' '}via ECO:{' '}
                          <span className="font-medium text-foreground">{version.eco_title}</span>
                        </>
                      )}
                    </p>

                    {version.fields_changed && version.fields_changed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {version.fields_changed.map((field) => (
                          <Badge key={field} variant="outline" className="text-xs font-normal">
                            {field.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {!version.is_current && canRollback && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollback(version.id)}
                          disabled={rollbackLoadingId === version.id}
                          className="gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {rollbackLoadingId === version.id ? 'Rolling back...' : 'Rollback to This Version'}
                        </Button>
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
