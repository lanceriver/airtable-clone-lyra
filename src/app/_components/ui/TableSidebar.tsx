"use client"

import { useState, useEffect, useRef } from "react"
import { api } from "~/trpc/react"
import { toast } from "sonner"
import {
  Calendar,
  ChevronDown,
  Grid,
  LayoutGrid,
  List,
  Plus,
  Search,
  Check,
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"

type SidebarProps = {
  tableId: string;
  filters: {
    columnId: string;
    columnName?: string;
    value?: string | number;
    operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty" | "gte" | "lte" | "gt" | "lt";
  } | null,
  sort: {
    columnId: string;
    order: "asc" | "desc";  
  } | null,
  activeViewId?: string;
  handleViewChange?: (viewId: string) => void;
};

export default function TableSidebar({ tableId, filters, sort, activeViewId, handleViewChange }: SidebarProps) {
  const utils = api.useUtils()

  const [createExpanded, setCreateExpanded] = useState(true);
  const [viewName, setViewName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  console.log("TableSidebar props:", {
    tableId,
    filters,
    sort,
    activeViewId,
    handleViewChange,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      // Update existing view
      if (editName === "") {
        toast.error("Please enter a new name for the view.");
        return;
      }
      updateView({
        id: activeViewId ?? "",
        name: editName,
      });
      setIsEditing(false);
      setEditName("");
      return;
    }
    else {
      if (viewName === "") {
        toast.error("Please enter a view name.");
        return;
      } 
      createView({ 
      name: viewName, 
      tableId: tableId, 
      filters: undefined,
      sort: undefined,
    });
    }
    
  }

  const { data: views, isLoading: isViewsLoading } = api.view.getViews.useQuery({
    tableId: tableId
  });

  const { mutate: createView } = api.view.createView.useMutation({
    onSuccess: (newView) => {
      void utils.view.getViews.invalidate();
      toast.success(`View "${newView.name}" created successfully!`);
    },
    onError: (error) => {
      toast.error(`Failed to create view: ${error.message}`);
    }
  });

  const { mutate: updateView } = api.view.updateView.useMutation({
    onSuccess: (newView) => {
      void utils.view.getViews.invalidate();
      toast.success(`View "${newView.name}" updated successfully!`);
    },
    onError: (error) => {
      toast.error(`Failed to update view: ${error.message}`);
    }
  })

  const { mutate: deleteView } = api.view.deleteView.useMutation({
    onSuccess: () => {
      void utils.view.getViews.invalidate();
      toast.success(`View deleted successfully!`);
    },
    onError: (error) => {
      toast.error(`Failed to delete view: ${error.message}`);
    }
  })
 
  const handleViewClick = (viewId: string) => {
    handleViewChange?.(viewId);
  }



  return (
    <div className="flex overflow-hidden">
              <div className="w-64 border-r flex flex-col overflow-auto">
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Find a view" className="pl-8 h-9 text-sm" />
            </div>

              {views?.map(view => (
                <div key={view.id} className="w-full">
                <ContextMenu>
                  <ContextMenuTrigger className="flex items-center w-full">
                        <Button variant="ghost" className={`w-full justify-start gap-2 ${view.id === activeViewId ? 'bg-blue-50' : ''} hover:bg-blue-100 mb-4`}
                          onClick={() => handleViewClick(view.id)}>
                          <Grid className="h-4 w-4 text-blue-600" />  
                              {isEditing && view.id === activeViewId ? <form onSubmit={handleSubmit}>
                                  <Input value={editName || viewName} onChange={(e) => setEditName(e.target.value)}></Input>
                                </form> : <span key={view.id} className="text-sm">{view.name}</span>}
                          <Check className="ml-auto h-4 w-4 text-gray-600" />
                        </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onClick={() => setIsEditing(true)}>Rename view</ContextMenuItem>
                      <ContextMenuItem onClick={() => deleteView({id: view.id})}>Delete view</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                
                </div>
                
              ))}


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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4">
                      <div className="mb-4">
                        <Input placeholder="Enter view name" className="w-full" onChange={(e) => setViewName(e.target.value)}/>
                      </div>
                      <div className="flex flex-2 gap-x-2">
                        <Button variant="ghost">
                          Cancel
                        </Button>
                        <Button variant="default" className="bg-blue-400 text-white" onClick={handleSubmit}>
                          Create new view
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
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
    </div>
  )
}
