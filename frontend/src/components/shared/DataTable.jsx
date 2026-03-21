import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

/**
 * Reusable DataTable component
 *
 * @param {Object} props
 * @param {Array<{ key, label, render? }>} props.columns
 * @param {Array} props.data
 * @param {string} props.searchPlaceholder
 * @param {function} props.onSearch
 * @param {boolean} props.isLoading
 * @param {function} props.onRowClick
 * @param {function} props.actions - (row) => ReactNode
 * @param {string} props.emptyMessage
 */
export default function DataTable({
  columns,
  data,
  searchPlaceholder = 'Search...',
  onSearch,
  isLoading = false,
  onRowClick,
  actions,
  emptyMessage = 'No data available',
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearch = (e) => {
    const val = e.target.value
    setSearchTerm(val)
    if (onSearch) {
      onSearch(val)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      {onSearch && (
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            className="pl-8"
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
      )}

      {/* Table Area */}
      <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                {actions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading Skeletons
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((col, colIndex) => (
                      <TableCell key={colIndex}>
                        <Skeleton className="h-4 w-[80%]" />
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-8 ml-auto" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : data && data.length > 0 ? (
                // Data Rows
                data.map((row, rowIndex) => (
                  <TableRow
                    key={row.id || rowIndex}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.render ? col.render(row) : row[col.key]}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">{actions(row)}</div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                // Empty State
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
