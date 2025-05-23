import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function CreateColumn({ tableId, colCount } : { tableId: string, colCount: number}) {
    const utils = api.useUtils();
    const [columnName, setColumnName] = useState("");
    const [columnType, setColumnType] = useState("string"); 
    const [dialogOpen, setDialogOpen] = useState(false);
    const [error, setError] = useState(false);
    const { mutate: createNewColumn } = api.column.createNewColumn.useMutation({
            onSuccess: () => {
              utils.column.getColumns.invalidate();
              setDialogOpen(false);
              setColumnName("");
             console.log("Column createed");
            },
            onError: (error) => {
                setError(true);
                console.error("Error creating column:", error);
            }
        })
      const handleCreate = (tableId: string, position: number, name: string, type: string) => {
        createNewColumn({
            tableId: tableId,
            position: position,
            name: name,
            type: type
        });
      }
      useEffect(() => {
        if (error) {
        toast("Please enter a valid and unique column name.");
        const timer = setTimeout(() => setError(false), 3000); // 3 seconds
        return () => clearTimeout(timer);
        }
        }, [error]);
    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-none bg-gray-400">
                    <Plus className="mr-2 h-4 w-4 justify-center" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                            Add Column
                </DropdownMenuItem>
                </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                              Add Column
                            </DialogTitle>
                            <DialogDescription>
                                Add a new column to the table. Make sure to give it a unique name.
                            </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Column Name
                            </Label>
                            <Input id="name" placeholder="Column name" className="col-span-3" value={columnName} onChange={(e) => setColumnName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                            </div>
                            </div>
                            <DialogFooter>
                                    <Button type="submit" onClick={() => handleCreate(tableId, colCount, columnName, "string")}>Save changes</Button>
                            </DialogFooter>
                            </DialogContent>
                            </Dialog>
        </>
        
    )
}