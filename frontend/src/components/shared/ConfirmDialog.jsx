import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Reusable confirmation dialog.
 *
 * @param {boolean} open
 * @param {function} onOpenChange
 * @param {string} title
 * @param {string} description
 * @param {string} confirmLabel - default 'Confirm'
 * @param {string} cancelLabel  - default 'Cancel'
 * @param {'default'|'destructive'} variant
 * @param {function} onConfirm
 * @param {boolean} isLoading
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
