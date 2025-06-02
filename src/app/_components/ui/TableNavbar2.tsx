"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Grid,
  LayoutGrid,
  List,
  Menu,
  Plus,
  Search,
  Share2,
  Sliders,
  ArrowUpDown,
  EyeOff,
  Palette,
  Filter,
  Check,
  TrashIcon
} from "lucide-react"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "~/components/ui/dropdown-menu"
import TableSidebar from "./TableSidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { api } from "~/trpc/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { toast } from "sonner"
import { set } from "zod"

type Table = {
    baseId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    colCount: number;
    rowCount: number;
    seed: number | null;
    activeViewId: string | null;
};

type NavbarProps = {
      baseId: string, 
      initialTables: Table[], 
      tableCount: number, 
      tableId: string, 
      navbarColor?: string, 
      columnMap?: Map<string,string>,
      children: React.ReactNode, 
      handleSort: (columnId: string | null, order: "asc" | "desc") => void;
      handleFilters: (
      columnId: string | null,
      columnName?: string,
      operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty",
      value?: string | number
      ) => void;
}

export default function TableNavbar2({ baseId, initialTables, tableId, children, handleFilters, columnMap, handleSort  }: NavbarProps ) {
  const utils = api.useUtils();

  const [operator, setOperator] = useState<"contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty" | "">("");
  const [columnName, setColumnName] = useState("");
  const [value, setValue] = useState("");
  const[isOpen, setIsOpen] = useState(false);

  const handlePopoverClose = (open: boolean) => {
    if (!open && columnName && operator && value) {
      setTimeout(() => {
        handleSubmitFilters();
      }, 0);
    }
    setIsOpen(open);
  };

  const handleSubmitFilters = () => {
    if (!columnName || !operator) {
      toast.error("Please select a column, operator, and provide a value.");
      return;
    }
    if (value === null && operator !== "empty" && operator !== "is not empty") {
      toast.error("Please provide a value for the selected operator.");
      return;
    }
    if (
      operator === "contains" ||
      operator === "does not contain" ||
      operator === "is" ||
      operator === "is not" ||
      operator === "empty" ||
      operator === "is not empty"
    ) {
      const columnId = columnMap?.get(columnName) ?? "";
      if (!columnId) {
        toast.error("Invalid column selected");
        return;
    }
      let filterValue: string | number | undefined = value ?? undefined;
      if (operator === "empty" || operator === "is not empty") {
        setValue("");
        filterValue = undefined;
      }
      handleFilters(columnId, columnName, operator, filterValue);
      
      console.log("Filters submitted:", {
        columnId,
        columnName,
        operator,
        value: filterValue,
      });
      setIsOpen(false);
    }
  }

  const handleClearFilters = () => {
    setColumnName("");
    setOperator("");
    setValue("");
    handleFilters(null);
    setIsOpen(false);
  }

  const [popoverOpen, setPopoverOpen] = useState(false);
  const { data: tables, isLoading } = api.table.getTables.useQuery({ baseId }, {
        initialData: initialTables,});
  const { mutate: create100krows, isPending: is100KPending } = api.row.create100krows.useMutation({
    onSuccess: () => {
      toast.success("100k rows created successfully!");
      void utils.row.getRows.invalidate();
    },
    onError: (error) => {
      toast.error("Error creating rows. Please try again later.")
    },
  });

  
  const { data: columns, isLoading: isColumnsLoading } = api.column.getColumns.useQuery({ tableId: tableId });
  const columnNames = columns ? columns.map((col) => col?.name) : [];
  console.log(columnNames);

  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
      if (is100KPending) {
          toastIdRef.current = toast("100k rows are currently being added. Please be patient!", {duration: Infinity});
      }
      if (!is100KPending) {
        toast.dismiss(toastIdRef.current ?? undefined);
        toastIdRef.current = null;
      }
  }, [is100KPending])

  const handleCreateColumn = (tableId: string) => {
    create100krows({ tableId });
  }
  
  const operators: Array<"contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty"> = [
    "contains",
    "does not contain",
    "is",
    "is not",
    "empty",
    "is not empty"
  ];

  const operatorRequiresValue = operator !== "empty" && operator !== "is not empty";

  return (
    <div className="flex flex-col h-screen">
      {/* Secondary navigation */}
      <div className="flex items-center border-b px-2 py-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                <Menu className="h-4 w-4" />
                <span>Views</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle view sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="mx-2 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <Grid className="h-4 w-4 text-blue-600" />
              <span>Grid view</span>
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <Grid className="h-4 w-4 mr-2 text-blue-600" />
              <span>Grid view</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Calendar className="h-4 w-4 mr-2 text-orange-500" />
              <span>Calendar</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LayoutGrid className="h-4 w-4 mr-2 text-purple-600" />
              <span>Gallery</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="h-8 gap-1">
          <EyeOff className="h-4 w-4" />
          <span>Hide fields</span>
        </Button>

        <Popover open={isOpen} onOpenChange={handlePopoverClose}>
          <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </Button>
          </PopoverTrigger>
          <PopoverContent className="grid grid-cols-1 gap-y-5 w-full max-w-[500px]">
            <Label htmlFor="name" className="text-right">
              In this view, show records
            </Label>
            <div className="flex flex-row gap-2 items-center">
              <Label htmlFor="column">Where</Label>
              <Select onValueChange={(value) => {
                setColumnName(value); 
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a column"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Columns</SelectLabel>
                    {columnNames.map(column => (
                      <SelectItem key={column} value={column}>{column}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setOperator(value as typeof operator)}>
                <SelectTrigger>
                  <SelectValue placeholder="contains"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Operators</SelectLabel>
                    {operators.map(operator => (
                      <SelectItem key={operator} value={operator}>{operator}...</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {operatorRequiresValue && (
                <Input placeholder="Value" className="text-sm" value={value} onChange={(e) => setValue(e.target.value)}/>
              )}
              <TrashIcon className="h-20 w-20 hover:text-red-500 cursor-pointer" onClick={() => handleClearFilters()}/>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSubmitFilters}>
              Apply filter
            </Button>
          </PopoverContent>
        </Popover>

        

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <LayoutGrid className="h-4 w-4" />
              <span>Group</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Group by...</DropdownMenuItem>
            <DropdownMenuItem>Clear grouping</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <ArrowUpDown className="h-4 w-4" />
              <span>Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Sort by...</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort(null, "asc")}>Clear sorting</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <Palette className="h-4 w-4" />
              <span>Color</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Color by...</DropdownMenuItem>
            <DropdownMenuItem>Clear colors</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sliders className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="sm" className="h-8  gap-1">
          <Share2 className="h-4 w-4" />
          <span>Share and sync</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          disabled={is100KPending}
          onClick={() => {
          create100krows({ tableId: tableId});
        }}
        >
        {!is100KPending && <span>Add 100k rows</span>}
        {is100KPending && <span className="animate-pulse">Adding 100k rows...</span>}
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="px-4 py-2 h-10 rounded-none text-white hover:bg-blue-700 hover:text-white"
              >
                Extensions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Extension 1</DropdownMenuItem>
              <DropdownMenuItem>Extension 2</DropdownMenuItem>
              <DropdownMenuItem>Extension 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="px-4 py-2 h-10 rounded-none text-white hover:bg-blue-700 hover:text-white"
              >
                Tools <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Tool 1</DropdownMenuItem>
              <DropdownMenuItem>Tool 2</DropdownMenuItem>
              <DropdownMenuItem>Tool 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex w-full overflow-auto">
        {/* Sidebar */}
           <TableSidebar></TableSidebar>
        {/* Main content area - left blank for user to implement */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
