export default function FormField({ label, error, children, className = '' }) {
  return (
    <div className={`space-y-1.5 flex flex-col ${className}`}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      {children}
      {error && (
        <span className="text-[0.8rem] font-medium text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
