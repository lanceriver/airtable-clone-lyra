"use client"

import { useState } from "react"
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
} from "lucide-react"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "~/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { api } from "~/trpc/react"
import { TableDropdown } from "./TableDropdown"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "~/components/ui/dialog";
import { CreateTableForm } from "./CreateTable"

type Table = {
    baseId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    colCount: number;
    rowCount: number;
    seed: number | null;
};

export default function TableNavbar2({ baseId, initialTables, tableCount, children, navbarColor }: { baseId: string, initialTables: Table[], tableCount: number, children: React.ReactNode, navbarColor?: string }) {
  const [selectedTab, setSelectedTab] = useState(initialTables[0]?.name ?? "Table 1");
  const [createExpanded, setCreateExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: tables, isLoading } = api.table.getTables.useQuery({ baseId }, {
        initialData: initialTables,});
  const colorOptions = [
        "bg-blue-700/90",
        "bg-red-700/90",
        "bg-green-700/90",
        "bg-white-700/90",
        "bg-orange-700/90",
        "bg-yellow-700/90",
        "bg-purple-700/90"
    ];      
  return (
    <div className="flex flex-col h-screen">
      {/* Top navigation */}
      <div className="flex items-center bg-blue-700/90  text-black font-normal py-0">
        {tables?.map((table) => (             
                <TableDropdown key={table.id} baseId={baseId} tableId={table.id} tableName={table.name} selectedTab={selectedTab} setSelectedTab={setSelectedTab} tableCount={tables.length} firstTableId={tables?.[0]?.id ?? ""}/>
          ))}

        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none text-white hover:bg-blue-700">
          <ChevronDown className="h-4 w-4" />
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-white  hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                  <Button variant="ghost">
                      Create new table
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create new table</DialogTitle>
                                    <DialogDescription>Build your table from scratch.</DialogDescription>
                                </DialogHeader>
                                <CreateTableForm baseId={baseId} onSuccess={() => setDialogOpen(false)} 
                                    />
                                    <DialogFooter className="flex justify-between w-full">
                                    <div>
                                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                    <div>
                                        <Button className="bg-blue-800 text-white hover:bg-blue-400 hover:text-white" variant="outline" type="submit" form="create-table-form">
                                            Create
                                        </Button>
                                    </div>   
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
        <div className="ml-auto flex items-center">
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
        </div>
      </div>

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Add filter</DropdownMenuItem>
            <DropdownMenuItem>Clear filters</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            <DropdownMenuItem>Clear sorting</DropdownMenuItem>
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

        <Button variant="ghost" size="sm" className="h-8 gap-1">
          <Share2 className="h-4 w-4" />
          <span>Share and sync</span>
        </Button>

        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col overflow-auto">
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Find a view" className="pl-8 h-9 text-sm" />
            </div>

            <Button variant="ghost" className="w-full justify-start gap-2 bg-blue-50 hover:bg-blue-100 mb-4">
              <Grid className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Grid view</span>
              <Check className="ml-auto h-4 w-4 text-gray-600" />
            </Button>

            {/* Create section */}
            <Collapsible open={createExpanded} onOpenChange={setCreateExpanded} className="border-t pt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-1 py-1 h-8 mb-2">
                  <span className="text-sm font-medium">Create...</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${createExpanded ? "" : "transform rotate-180"}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1">
                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <Grid className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Grid</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Calendar</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Gallery</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-green-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                      </svg>
                    </div>
                    <span className="text-sm">Kanban</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-red-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <polyline points="8 7 3 12 8 17" />
                        <polyline points="16 7 21 12 16 17" />
                      </svg>
                    </div>
                    <span className="text-sm">Timeline</span>
                    
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">List</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-green-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="7" y1="4" x2="7" y2="20" />
                      </svg>
                    </div>
                    <span className="text-sm">Gantt</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">New section</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Separator className="my-2" />

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-pink-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>
                    <span className="text-sm">Form</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
        {/* Main content area - left blank for user to implement */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
