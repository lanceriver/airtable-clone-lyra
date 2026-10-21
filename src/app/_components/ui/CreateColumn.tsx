import { useState } from "react";
import { api } from "~/trpc/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function CreateColumn({ tableId } : { tableId: string }) {
    const utils = api.useUtils();
    const [columnName, setColumnName] = useState("");
    const [columnType, setColumnType] = useState<"string" | "number">("string");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const { mutate: createColumn, isPending: isCreating } = api.column.create.useMutation({
        onSuccess: () => {
            void utils.table.get.invalidate({ tableId });
            setCreateDialogOpen(false);
            setColumnName("");
            setColumnType("string");
            toast.success("Column created successfully!");
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const handleCreate = () => {
        const name = columnName.trim();
        if (name === "") {
            toast.error("Please enter a column name.");
            return;
        }
        createColumn({ tableId, name, type: columnType });
    }

    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="cursor-pointer h-[32.5px] border-t-0 border-b-1 border-l-0 rounded-none bg-gray-100">
                    <Plus className=" h-4 w-4 justify-center" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                            Add Column
                </DropdownMenuItem>
                </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                            <div className="grid grid-cols-4 items-center gap-6">
                            <Label htmlFor="name" className="text-right">
                                Column Name
                            </Label>
                            <Input id="name" placeholder="Column name" className="col-span-3" value={columnName} onChange={(e) => setColumnName(e.target.value)} />
                            <Label htmlFor="type" className="text-right">
                                Column Type
                            </Label>
                            <Select value={columnType} onValueChange={(value) => setColumnType(value as "string" | "number")}>
                              <SelectTrigger id="type" className="col-span-3 w-full">
                                <SelectValue placeholder="Select a column type"/>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                              </SelectContent>
                            </Select>
                            </div>
                            </div>
                            <DialogFooter>
                                    <Button type="submit" disabled={isCreating} onClick={handleCreate}>{isCreating ? "Saving..." : "Save changes"}</Button>
                            </DialogFooter>
                            </DialogContent>
                        </Dialog>
        </>
        
    )
}
