"use client"

import * as React from "react"
import { Checkbox } from "./checkbox"
import { Label } from "./label"
import { Card } from "./card"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"

interface Role {
  id: number
  name: string
  description: string
}

interface MultiSelectRolesProps {
  roles: Role[]
  selectedRoleIds: number[]
  onSelectionChange: (selectedIds: number[]) => void
  className?: string
  required?: boolean
}

export function MultiSelectRoles({
  roles,
  selectedRoleIds,
  onSelectionChange,
  className,
  required = false
}: MultiSelectRolesProps) {
  const handleRoleToggle = (roleId: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedRoleIds, roleId])
    } else {
      onSelectionChange(selectedRoleIds.filter(id => id !== roleId))
    }
  }

  const selectedRoles = roles.filter(role => selectedRoleIds.includes(role.id))

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selected roles preview */}
      {selectedRoles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">選択された役割:</Label>
          <div className="flex flex-wrap gap-1">
            {selectedRoles.map(role => (
              <Badge key={role.id} variant="default" className="text-xs">
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Role selection checkboxes */}
      <Card className="p-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            役割を選択してください {required && <span className="text-red-500">*</span>}
          </Label>
          <div className="grid gap-3">
            {roles.map(role => (
              <div key={role.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selectedRoleIds.includes(role.id)}
                  onCheckedChange={(checked) => handleRoleToggle(role.id, checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor={`role-${role.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {role.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {role.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        複数の役割を選択できます。少なくとも1つの役割を選択してください。
      </p>
    </div>
  )
}