import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";


export function ColumnDropdown({ columnId, columnName, tableId}: { columnId: string, columnName: string, tableId: string}) {
    const utils = api.useUtils();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [name, setName] = useState(columnName);

    const { mutate: deleteColumn } = api.column.delete.useMutation({
        onSuccess: () => {
            void utils.table.get.invalidate({ tableId });
            // Deleting a column also removes it from views' filters, sort and hidden fields.
            void utils.view.get.invalidate();
            void utils.row.getRows.reset();
            void utils.row.countRows.invalidate();
            setDeleteOpen(false);
            toast.success("Column deleted successfully!");
        },
        onError: (error) => {
            setDeleteOpen(false);
            toast.error(error.message);
        }
    });

    const { mutate: renameColumn } = api.column.rename.useMutation({
        onSuccess: () => {
            void utils.table.get.invalidate({ tableId });
            setRenameOpen(false);
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const handleRename = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed === "") {
            toast.error("Please enter a column name.");
            return;
        }
        if (trimmed === columnName) {
            setRenameOpen(false);
            return;
        }
        renameColumn({ columnId, name: trimmed });
    }

    return (
        <div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>   
                        <button className="mr-2 h-4 w-4 flex items-center justify-center cursor-pointer">
                            <ChevronDown className="h-4 w-4 cursor-pointer" />
                        </button>    
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={() => {
                        setName(columnName);
                        setRenameOpen(true);
                    }}>
                        Rename Column
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                        Delete Column
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent>
                    <form onSubmit={handleRename} className="grid gap-4">
                        <DialogHeader>
                            <DialogTitle>
                                Rename Column
                            </DialogTitle>
                            <DialogDescription>
                                Enter a new, unique name for this column.
                            </DialogDescription>
                        </DialogHeader>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
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
                            <Button variant="destructive" onClick={() => deleteColumn({ columnId })}>
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    )
}
