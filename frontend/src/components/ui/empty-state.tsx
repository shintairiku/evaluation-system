"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div className={"text-center py-8 " + (className || "")}> 
      <div className="mx-auto mb-4 flex items-center justify-center h-12 w-12 text-muted-foreground">
        {icon ?? <AlertCircle className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-semibold text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      )}
    </div>
  );
}

export default EmptyState;


