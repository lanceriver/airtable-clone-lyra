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

export function CreateBaseForm() {
    const { mutate: createBase } = api.base.createBase.useMutation();
    const [baseName, setBaseName] = useState("");
    const utils = api.useUtils();

    const handleSubmit = () => {
        console.log("Base name: ", baseName);
        setBaseName("");
        createBase({ name: baseName }, {
            onSuccess: () => {
                utils.base.getBases.invalidate()
            }
        })
    }
    return (
        <div>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="ml-8">Create new base</Button>
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