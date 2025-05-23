import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { api } from "~/trpc/react";


export function ColumnDropdown({ columnId, columnName, tableId}: { columnId: string, columnName: string, tableId: string }) {
    const utils = api.useUtils();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const { mutate: deleteColumn } = api.column.deleteColumn.useMutation({
        onSuccess: () => {
            void utils.column.getColumns.invalidate();
            setDeleteOpen(false);
        },
        onError: (error) => {
            console.error("Error deleting column:", error);
        }
    });
    const handleDelete = () => {
        deleteColumn({ columnId: columnId, tableId: tableId});
    }
    return (
        <div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-none bg-gray-400">
                    <ChevronDown className="mr-2 h-4 w-4 justify-center" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuItem>
                        Rename Column
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                        Delete Column
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Delete Column
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete column {columnName}?
                        </DialogDescription>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={() => handleDelete()}>
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    )
}