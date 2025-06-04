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
import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";


export function ColumnDropdown({ columnId, columnName, tableId}: { columnId: string, columnName: string, tableId: string}) {
    const utils = api.useUtils();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [name, setName] = useState("");
    const { mutate: deleteColumn } = api.column.deleteColumn.useMutation({
        onSuccess: () => {
            void utils.column.getColumns.invalidate();
            setDeleteOpen(false);
            toast.success("Column deleted successfully!");
        },
        onError: (error) => {
            toast.error("Error deleting column: " + error.message);
        }
    });
    const handleDelete = () => {
        deleteColumn({ columnId: columnId, tableId: tableId});
    }
    const { mutate: editColumn } = api.column.editColumn.useMutation({
        onSuccess: () => {
            void utils.column.getColumns.invalidate();
            setEditOpen(false);
        },
        onError: (error) => {
            console.error("Error editing column:", error);
        }
    });
    /* const handleEdit = ({}) => {
        editColumn({columnId: columnId, tableId: tableId, newName: newName})
    } */
    return (
        <div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>   
                        <button className="mr-2 h-4 w-4 flex items-center justify-center cursor-pointer">
                            <ChevronDown className="h-4 w-4" />
                        </button>    
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuItem>
                        Rename Column
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                        Delete Column
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        Hide Column
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
            {/* <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
            </Dialog> */}
        </div>
    )
}