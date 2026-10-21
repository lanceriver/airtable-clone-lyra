"use client"
import { Button } from "~/components/ui/button"
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
import { useState } from "react"
import { api } from "~/trpc/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function CreateBaseForm() {
    const router = useRouter();
    const utils = api.useUtils();
    const { mutate: createBase } = api.base.create.useMutation({
        onSuccess: (base) => {
            void utils.base.list.invalidate();
            router.push(`/${base.id}/${base.tableId}?viewId=${base.viewId}`);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const [baseName, setBaseName] = useState("");

    const handleSubmit = () => {
        createBase({ name: baseName.trim() || undefined });
        setBaseName("");
    }
    return (
        <div>
            <Dialog>
                <DialogTrigger asChild className="items-center">
                    <div>
                        <Button variant="default" className="justify-center cursor-pointer text-white py-2 px-24 rounded-sm bg-blue-500 hover:bg-blue-700">Create</Button>
                    </div>
                </DialogTrigger>
                <DialogContent className="max-w">
                    <DialogHeader>
                        <DialogTitle>
                            Create new base
                        </DialogTitle>
                        <DialogDescription>
                            Build your base from scratch.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Base name
                            </Label>
                            <Input id="name" placeholder="Base name" className="col-span-3" value={baseName} onChange={(e) => setBaseName(e.target.value)}/>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button onClick={handleSubmit} type="submit">Create</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>     
            </Dialog>
        </div>
    )
}