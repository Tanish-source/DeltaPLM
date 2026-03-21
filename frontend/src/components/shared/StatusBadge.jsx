import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ECO_STATUS_LABELS, ECO_STATUS_STYLES } from '@/lib/constants';

export const StatusBadge = ({ status, className = '' }) => {
  const label = ECO_STATUS_LABELS[status] || status || 'Unknown';
  
  // Use tailwind classes defined in constants, default to a gray outline if missing
  const statusClassName = ECO_STATUS_STYLES[status] || 'bg-gray-50 text-muted-foreground border-gray-200';
  
  return (
    <Badge 
      variant="outline"
      className={`font-medium ${statusClassName} ${className}`}
    >
      {label}
    </Badge>
  );
};

export default StatusBadge;

