"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
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
  X,
  CrossIcon,
  TrashIcon
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "~/components/ui/dropdown-menu"
import TableSidebar from "./TableSidebar";
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
import { Switch } from "~/components/ui/switch"
import { type ViewFilter } from "~/server/api/routers/view"
import { toast } from "sonner"
import { type TableProps } from "./Table"
import { table } from "console"
 
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
      columnTypes?: Record<string, string>,
      children: React.ReactNode, 
      sort: {
        columnId: string;
        order: "asc" | "desc";
      } | null,
      filters: ViewFilter[] | null,
      activeViewId?: string | null,
      handleSort: (columnId: string | null, order: "asc" | "desc", type: "string" | "number") => void;
      handleFilters: (
      columnId: string | null,
      operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty" | "gt" | "lt" | "gte" | "lte",
      value?: string | number
      ) => void;
      removeFilters: (columnId: string) => void;
      handleViewChange? : (viewId: string) => void;
      columnVisibility?: Record<string, boolean>;
}

const numberOperators: string[] = [
  "gt",
  "lt",
  "gte",
  "lte",
  "is",
  "is not",
];

const textOperators: string[] = [
  "contains",
  "does not contain",
  "is",
  "is not",
  "empty",
  "is not empty"
];

export default function TableNavbar2({ baseId, tableId, children, handleFilters, removeFilters, columnMap, handleSort, filters, sort, activeViewId, handleViewChange, columnVisibility, columnTypes  }: NavbarProps ) {
  const utils = api.useUtils();

  const columnFilter = filters?.find((f) => f.columnId !== "globalSearch");

  console.log("columnFilter is:", columnFilter);

  const { data: columns, isLoading: isColumnsLoading } = api.column.getColumns.useQuery({ tableId: tableId });

  const prevFilter = columns?.find((column => column.id === columnFilter?.columnId));

  console.log("prevFilter is:", prevFilter);
  
  const columnNames = columns ? columns.map((col) => col?.name) : [];

  console.log(columnNames);

  const [operator, setOperator] = useState(() => {
    return columnFilter?.operator ?? "contains" as
      | "contains"
      | "does not contain"
      | "is"
      | "is not"
      | "empty"
      | "is not empty"
      | "gt"
      | "lt"
      | "gte"
      | "lte"
      | "";
  }, );

  const [columnName, setColumnName] = useState(() => { 
    return prevFilter?.name ?? ""
  });

  useEffect(() => {
  if (prevFilter?.name) {
    setColumnName(prevFilter.name);
  }
}, [prevFilter]);

useEffect(() => {
  return () => {
    setGlobalSearch("");
    removeFilters("globalSearch");
  };
}, [tableId, activeViewId]);

  useEffect(() => {
    if (columnFilter?.operator) {
      setOperator(columnFilter.operator);
    }
  }, [columnFilter]);

  console.log("columnName is:", columnName);

  const [sortColumn, setSortColumn] = useState("");
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(undefined as unknown as string);
  const [isFiltered, setIsFiltered] = useState(false);
  const [isSorted, setIsSorted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handlePopoverClose = (open: boolean) => {
    if (!open && columnName && operator && value) {
      setTimeout(() => {
        handleSubmitFilters();
      }, 0);
    }
    setIsOpen(open);
  };

  console.log("filters are:", filters);

  useEffect(() => {
    const handleSearch = setTimeout(() => {
      if (globalSearch === undefined || globalSearch === null || globalSearch === "") {
        return;
      }
      if (!globalSearch.trim() && isSearching) {
        handleFilters("globalSearch", "contains", undefined);
        return;
      } 
    if (!isNaN(Number(globalSearch.trim()))) {
      handleFilters("globalSearch", "contains", Number(globalSearch.trim()));
    }
    else {
      handleFilters("globalSearch", "contains", globalSearch.trim());
    }
    
  }, 500)

    return () => clearTimeout(handleSearch);
  }, [globalSearch]);

  const handleSubmitFilters = () => {
    console.log("Submitting filters with columnName:", columnName, "operator:", operator, "value:", value);
    if (!columnName || !operator || (value === "" && operator !== "empty" && operator !== "is not empty")) {
      toast.error("Please select a column, operator, and provide a value.");
      return;
    }
    if (value === null && operator !== "empty" && operator !== "is not empty") {
      toast.error("Please provide a value for the selected operator.");
      return;
    }
    if ( textOperators.includes(operator) || numberOperators.includes(operator)) {
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
      if (numberOperators.includes(operator)) {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          toast.error("Please provide a valid number for the selected operator.");
          return;
        }
        filterValue = numValue;
      }
      handleFilters(columnId, operator, filterValue);
      setIsFiltered(true);
      setIsOpen(false);
    }
  }

  console.log("columnMap is:", columnMap);

  const handleClearFilters = (columnName: string) => {
    removeFilters(prevFilter ? prevFilter.id : columnMap?.get(columnName) ?? "");
    setColumnName("");
    setOperator("");
    setValue("");
    setIsFiltered(false);
    setIsOpen(false);
  }


  const handleVisibilityChange = (columnId: string, isVisible: boolean) => {
    if (columnVisibility) {
      const updatedVisibility = { ...columnVisibility, [columnId]: isVisible };

      const visibleColumnsArray = Object.entries(updatedVisibility)
        .filter(([_, visible]) => visible)
        .map(([id]) => id);

      updateView({
        id: activeViewId ?? "",
        filters: filters ?? undefined,
        visibleColumns: visibleColumnsArray
      })
    }
  }

  const { mutate: updateView, isPending: isUpdatingView } = api.view.updateView.useMutation({
    onSuccess: () => {
      toast.success("View updated successfully!");
      void utils.row.getRows.invalidate();
      void utils.view.getActiveView.invalidate();
      void utils.view.getViews.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update view: ${error.message}`);
    }
  });

  const { mutate: create100krows, isPending: is100KPending } = api.row.create100krows.useMutation({
    onSuccess: () => {
      toast.success("100k rows created successfully!");
      void utils.row.getRows.invalidate();
    },
    onError: (error) => {
      toast.error("Error creating rows. Please try again later.")
    },
  });

  console.log("column types are:", columnTypes);

  

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

  const operatorRequiresValue = operator !== "empty" && operator !== "is not empty";

  return (
    <div className="flex flex-col h-screen">
      {/* Secondary navigation */}
      <div className="flex items-center border-b px-2 py-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
                <Menu className="h-4 w-4" />
                <span className="font-normal">Views</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle view sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="mx-2 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
              <Grid className="h-4 w-4 text-blue-600" />
              <span className="font-normal">Grid view</span>
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

        <Popover>
          <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
                <EyeOff className="h-4 w-4" />
                <span className="font-normal">Hide fields</span>
              </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4">
            <div className="space-y-4 mb-4">
              <h3 className="text-sm font-semibold">Hide/Show Fields</h3>
            </div>
            <div className="grid grid-cols-1 gap-y-4">
              {columns?.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Switch id={column.id} checked={columnVisibility?.[column.id] ?? true} onCheckedChange={(checked) => {handleVisibilityChange(column.id, checked)}}>
                  </Switch>
                  <Label htmlFor={column.id} className="text-sm">
                    {column.name}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        

        <Popover open={isOpen} onOpenChange={handlePopoverClose}>
          <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`cursor-pointer h-8 gap-1 ${(filters?.some(f => f.columnId !== "globalSearch")) ? "bg-[#eafbeb]" : ""}`}>  
                <Filter className="h-4 w-4" />
                {filters?.some(f => f.columnId !== "globalSearch") ? <span className="font-normal">Filtered by {prevFilter?.name}</span> : <span className="font-normal">Filter</span>}
              </Button>
          </PopoverTrigger>
          <PopoverContent className="grid grid-cols-1 gap-y-5 w-150">
            <Label htmlFor="name" className="text-right">
              In this view, show records
            </Label>
            <div className="flex flex-row gap-2 items-center">
              <Label htmlFor="column">Where</Label>
              <div className="flex flex-row items-center">
                <Select value={columnName} onValueChange={(value) => {
                setColumnName(value); 
              }}>
                <SelectTrigger className="w-[180px] rounded-none">
                  <SelectValue placeholder="Select a column" />
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
              <Select value={operator} onValueChange={(value) => setOperator(value as typeof operator)}>
                <SelectTrigger className="w-[180px] rounded-none">
                  <SelectValue placeholder="contains"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Operators</SelectLabel>
                    {columnTypes && columnTypes[columnName] === "number" ? (
                      numberOperators.map(operator => (
                        <SelectItem key={operator} value={operator}>{operator}...</SelectItem>
                      ))
                    ) : (
                      textOperators.map(operator => (
                        <SelectItem key={operator} value={operator}>{operator}...</SelectItem>
                      ))
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {operatorRequiresValue && (
                <Input placeholder={columnFilter?.value !== undefined ? String(columnFilter?.value) : ""} className="text-sm rounded-none" value={value} onChange={(e) => setValue(e.target.value)}/>
              )}
              <div className="border">
                <TrashIcon className="h-[34px] w-[33px] hover:text-red-500 cursor-pointer" onClick={() => handleClearFilters(columnName)}/>
              </div>
              
            </div>
              </div>
              
            <Button variant="ghost" size="sm" onClick={handleSubmitFilters}>
              Apply filter
            </Button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className={`cursor-pointer h-8 gap-1 ${sort ? "bg-[#fef3ea]" : ""}`}>
              <ArrowUpDown className="h-4 w-4" />
              <span className="font-normal">Sort</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-120 p-4">
            <div className="mb-4 flex flex-row items-center justify-between">
              <h1 className="text-sm font-semibold">Sort by</h1>
              <h1 className="text-xs font-normal">Copy from a view</h1>
            </div>
           <div className="grid grid-cols-12 gap-x-4 items-center">
              <div className="col-span-5">
                <Select onValueChange={(value) => {
                  setSortColumn(value);
                }}>
                  <SelectTrigger className="w-full rounded-none">
                    <SelectValue className="text-sm" placeholder="Select a column" />
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
              </div>
              <div className="col-span-5">
                <Select onValueChange={(value) => {
                  const columnId = columnMap?.get(sortColumn) ?? null;
                  const columnType = (columnTypes?.[sortColumn]) as "string" | "number";
                  handleSort(columnId, value as "asc" | "desc", columnType);
                }}>
                  <SelectTrigger className="w-full rounded-none">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Sort Order</SelectLabel>
                      {columnTypes && columnTypes[sortColumn] === "number" ? (
                        <div>
                          <SelectItem value="asc">1 - 9</SelectItem>
                          <SelectItem value="desc">9 - 1</SelectItem>
                        </div>
                      ) : (
                        <div>
                          <SelectItem value="asc">A - Z</SelectItem>
                          <SelectItem value="desc">Z - A</SelectItem> 
                        </div>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center justify-center h-10">
                <X 
                  className="h-5 w-5 text-gray-500 cursor-pointer hover:text-gray-700" 
                  onClick={() => {
                    setSortColumn("");
                    handleSort(null, "asc", "string");
                  }}
                />
              </div>
            </div>  
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
              <Palette className="h-4 w-4" />
              <span className="font-normal">Color</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Color by...</DropdownMenuItem>
            <DropdownMenuItem>Clear colors</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="cursor-pointer h-8  gap-1">
          <Share2 className="h-4 w-4" />
          <span className="font-normal">Share and sync</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer h-8 gap-1"
          disabled={is100KPending}
          onClick={() => {
          create100krows({ tableId: tableId});
        }}
        >
        {!is100KPending && <span className="font-normal">Add 100k rows</span>}
        {is100KPending && <span className="animate-pulse font-normal">Adding 100k rows...</span>}
        </Button>
        <div className="ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Search className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 mr-5 p-0">
              <div>
                <form className="border-0 flex items-center gap-2 p-2">
                  <Input placeholder="Find in view" className="w-full h-10 border-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)}/>
                  <X className="" onClick={() => {
                    setGlobalSearch("");
                    removeFilters("globalSearch")
                  }
                    }/>
                </form>
                <button>
                  
                </button>
              </div>
              
              <div className="p-4 text-xs text-gray-500 bg-gray-100">
                Use advanced search options in the search extension.
              </div>
              
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className="flex w-full overflow-auto">
        {/* Sidebar */}
           <TableSidebar baseId={baseId} tableId={tableId} filters={filters} sort={sort} activeViewId={activeViewId} setIsFiltered={setIsFiltered} handleViewChange={handleViewChange}></TableSidebar>
        {/* Main content area - left blank for user to implement */}
        <div className="flex-1 overflow-hidden">
          {React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<TableProps>, { globalSearch: globalSearch || null })
            : children}
        </div>
      </div>
    </div>
  )
}
