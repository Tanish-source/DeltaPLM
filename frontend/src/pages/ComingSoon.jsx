import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Construction, ArrowLeft } from 'lucide-react'

/**
 * Placeholder page for routes not yet implemented.
 * Shows a friendly "coming soon" message.
 */
export default function ComingSoon() {
  const location = useLocation()

  // Derive page name from path
  const pageName = location.pathname
    .split('/')
    .filter(Boolean)[0]
    ?.replace(/^\w/, c => c.toUpperCase())
    ?.replace(/-/g, ' ') || 'Page'

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-6">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        {pageName} — Coming Soon
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        This page is under construction and will be available in the next phase.
      </p>
      <Button variant="outline" asChild>
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  )
}
