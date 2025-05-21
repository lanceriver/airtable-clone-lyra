"use client"

import { useState } from "react"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Grid,
  Layout,
  List,
  Menu,
  Plus,
  Search,
  Share2,
  Sliders,
  SortAsc,
  EyeOff,
  Palette,
  Filter,
} from "lucide-react"
import { cn } from "~/lib/utils"

export default function TableNavbar() {
  const [selectedTab, setSelectedTab] = useState("Table 1")
  const [createExpanded, setCreateExpanded] = useState(true)

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top navigation */}
      <div className="flex items-center bg-blue-600 text-white">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium flex items-center",
            selectedTab === "Table 1" ? "bg-blue-700" : "",
          )}
          onClick={() => setSelectedTab("Table 1")}
        >
          Table 1 <ChevronDown className="ml-1 h-4 w-4" />
        </button>
        <button
          className={cn("px-4 py-2 text-sm font-medium", selectedTab === "Table 2" ? "bg-blue-700" : "")}
          onClick={() => setSelectedTab("Table 2")}
        >
          Table 2
        </button>
        <button
          className={cn("px-4 py-2 text-sm font-medium", selectedTab === "12231" ? "bg-blue-700" : "")}
          onClick={() => setSelectedTab("12231")}
        >
          12231
        </button>
        <button
          className={cn("px-4 py-2 text-sm font-medium", selectedTab === "Table 4" ? "bg-blue-700" : "")}
          onClick={() => setSelectedTab("Table 4")}
        >
          Table 4
        </button>
        <button
          className={cn("px-4 py-2 text-sm font-medium", selectedTab === "Table 5" ? "bg-blue-700" : "")}
          onClick={() => setSelectedTab("Table 5")}
        >
          Table 5
        </button>
        <button
          className={cn("px-4 py-2 text-sm font-medium", selectedTab === "Table 6" ? "bg-blue-700" : "")}
          onClick={() => setSelectedTab("Table 6")}
        >
          Table 6
        </button>
        <button className="px-2 py-2 text-sm font-medium">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button className="px-2 py-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
        </button>
        <div className="ml-auto flex items-center">
          <button className="px-4 py-2 text-sm font-medium">Extensions</button>
          <button className="px-4 py-2 text-sm font-medium flex items-center">
            Tools <ChevronDown className="ml-1 h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Secondary navigation */}
      <div className="flex items-center border-b px-2 py-1.5">
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Menu className="h-4 w-4" />
          <span>Views</span>
        </button>
        <div className="border-l mx-2 h-5"></div>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Grid className="h-4 w-4 text-blue-600" />
          <span>Grid view</span>
          <ChevronDown className="ml-1 h-4 w-4" />
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <EyeOff className="h-4 w-4" />
          <span>Hide fields</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Filter className="h-4 w-4" />
          <span>Filter</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Layout className="h-4 w-4" />
          <span>Group</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <SortAsc className="h-4 w-4" />
          <span>Sort</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Palette className="h-4 w-4" />
          <span>Color</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Sliders className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100">
          <Share2 className="h-4 w-4" />
          <span>Share and sync</span>
        </button>
        <div className="ml-auto">
          <button className="p-1 rounded hover:bg-gray-100">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col overflow-auto">
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Find a view" className="w-full pl-8 pr-2 py-1.5 border rounded text-sm" />
            </div>

            <div className="bg-blue-50 rounded flex items-center justify-between p-2 mb-4">
              <div className="flex items-center gap-2">
                <Grid className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Grid view</span>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-600"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            {/* Create section */}
            <div className="mb-4 border-t pt-4">
              <button
                className="flex items-center justify-between w-full py-1 mb-2"
                onClick={() => setCreateExpanded(!createExpanded)}
              >
                <span className="text-sm font-medium">Create...</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${createExpanded ? "" : "transform rotate-180"}`}
                />
              </button>

              {createExpanded && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <Grid className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Grid</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Calendar</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 text-purple-600 flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </div>
                      <span className="text-sm">Gallery</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 text-green-600 flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="9" y1="3" x2="9" y2="21" />
                          <line x1="15" y1="3" x2="15" y2="21" />
                        </svg>
                      </div>
                      <span className="text-sm">Kanban</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 text-red-600 flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="3" y1="12" x2="21" y2="12" />
                          <polyline points="8 7 3 12 8 17" />
                          <polyline points="16 7 21 12 16 17" />
                        </svg>
                      </div>
                      <span className="text-sm">Timeline</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">List</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 text-green-600 flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <line x1="7" y1="4" x2="7" y2="20" />
                        </svg>
                      </div>
                      <span className="text-sm">Gantt</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">New section</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 rounded mt-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 text-pink-600 flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                      </div>
                      <span className="text-sm">Form</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content area - left blank for user to implement */}
        <div className="flex-1 overflow-auto">{/* This area is intentionally left blank for you to implement */}</div>
      </div>
    </div>
  )
}
