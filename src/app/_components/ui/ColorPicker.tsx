import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { ChevronDown } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"

export function ColorPicker({selectedColor, setSelectedColor, colorOptions, baseName}: {selectedColor: string, setSelectedColor: Dispatch<SetStateAction<string>>, colorOptions: string[], baseName:string}) {
    return (
        <div className="max-w-1/4">
            <Popover>
                <PopoverTrigger asChild>
                    <ChevronDown width={20} height={20} className="ml-2 text-white"></ChevronDown>
                </PopoverTrigger>
                <PopoverContent>
                    <div>
                                <div>
                        {baseName}
                    </div>
                    <div className="flex flex-row">
                        {colorOptions.map((color) => (
                            console.log(color),
                        <button
                       key={color}
                       className={`${color} w-6 h-6 rounded-full m-1 border-2 ${selectedColor === color ? "border-black" : "border-gray-300"}`}
                       onClick={() => setSelectedColor(color)}
                       aria-label={`Select color ${color}`}
                        />
                        ))}
                    </div>
                    </div>
                    
                
                </PopoverContent>
            </Popover>
        </div>
    )
}