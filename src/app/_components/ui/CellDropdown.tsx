import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Button } from "~/components/ui/button"
import { useState } from "react";

export function CellDropdown({cellId, rowId, columnId, open, onOpenChange}: { cellId: string, rowId: string, columnId: string, open: boolean, onOpenChange: (open: boolean) => void }) {
  return (
    <div>
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <button style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
            <DropdownMenuItem>Edit Cell</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
    </div>
  )
}