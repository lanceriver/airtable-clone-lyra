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
                        <button
                       key={color}
                       style={{ backgroundColor: color, width: 24, height: 24, borderRadius: "50%", margin: 4, border: selectedColor === color ? "2px solid #000" : "1px solid #ccc" }}
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