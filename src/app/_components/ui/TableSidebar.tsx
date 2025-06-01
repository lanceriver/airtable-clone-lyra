"use client"

import { useState, useEffect, useRef } from "react"
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
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"


export default function TableSidebar() {
  const [selectedTab, setSelectedTab] = useState("Table 1")
  const [viewsExpanded, setViewsExpanded] = useState(true)
  const [createExpanded, setCreateExpanded] = useState(true)

  return (
    <div className="flex overflow-hidden">
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
    </div>
  )
}
