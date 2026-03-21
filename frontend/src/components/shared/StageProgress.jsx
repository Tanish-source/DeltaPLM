import { Check, X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal stage progress stepper for ECO workflow.
 *
 * @param {Array<{id, name, sequence}>} stages
 * @param {number|string} currentStageId
 * @param {string} ecoStatus - 'new' | 'approval' | 'approved' | 'applied' | 'rejected'
 * @param {number|string} rejectedStageId - if rejected, which stage it was rejected at
 */
export default function StageProgress({
  stages = [],
  currentStageId,
  ecoStatus,
  rejectedStageId,
}) {
  if (!stages.length) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No approval stages configured.
      </p>
    )
  }

  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence)
  const currentIdx = sorted.findIndex((s) => s.id === currentStageId)

  const getStepState = (stage, idx) => {
    if (ecoStatus === 'approved' || ecoStatus === 'applied') return 'completed'
    if (ecoStatus === 'rejected' && stage.id === rejectedStageId) return 'rejected'
    if (ecoStatus === 'rejected' && idx < sorted.findIndex(s => s.id === rejectedStageId)) return 'completed'
    if (ecoStatus === 'rejected') return 'pending'
    if (idx < currentIdx) return 'completed'
    if (idx === currentIdx) return 'active'
    return 'pending'
  }

  return (
    <div className="flex items-center w-full overflow-x-auto py-2">
      {sorted.map((stage, idx) => {
        const state = getStepState(stage, idx)
        const isLast = idx === sorted.length - 1

        return (
          <div key={stage.id} className="flex items-center flex-1 min-w-0">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5 min-w-[4rem]">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all',
                  state === 'completed' && 'border-emerald-500 bg-emerald-500 text-white',
                  state === 'active' && 'border-blue-500 bg-white text-blue-700 ring-2 ring-blue-200 shadow-sm',
                  state === 'pending' && 'border-gray-200 bg-gray-50 text-gray-400',
                  state === 'rejected' && 'border-red-500 bg-red-500 text-white'
                )}
              >
                {state === 'completed' ? (
                  <Check className="h-4 w-4" />
                ) : state === 'rejected' ? (
                  <X className="h-4 w-4" />
                ) : state === 'active' ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs text-center truncate max-w-[5rem]',
                  state === 'active' && 'font-semibold text-foreground',
                  state === 'completed' && 'text-emerald-700',
                  state === 'rejected' && 'text-red-700 font-semibold',
                  state === 'pending' && 'text-muted-foreground'
                )}
                title={stage.name}
              >
                {stage.name}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-1',
                  (state === 'completed') ? 'bg-emerald-400' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
