"use client"

import { useState } from "react"
import { Check, ChevronDown, Grid, Menu, Search, Users } from "lucide-react"
import { cn } from "~/lib/utils"

export default function TableSidebar() {
  const [selectedTab, setSelectedTab] = useState("Table 1")
  const [viewsExpanded, setViewsExpanded] = useState(true)
  const [createExpanded, setCreateExpanded] = useState(true)

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top navigation */}
      <div className="flex border-b">
        <button
          className={cn(
            "px-4 py-3 text-lg font-medium flex items-center",
            selectedTab === "Table 1" ? "bg-blue-600 text-white" : "text-gray-800",
          )}
          onClick={() => setSelectedTab("Table 1")}
        >
          Table 1 <ChevronDown className="ml-1 h-5 w-5" />
        </button>
        <button
          className={cn(
            "px-4 py-3 text-lg font-medium",
            selectedTab === "Table 2" ? "bg-blue-600 text-white" : "text-gray-800",
          )}
          onClick={() => setSelectedTab("Table 2")}
        >
          Table 2
        </button>
        <button
          className={cn(
            "px-4 py-3 text-lg font-medium",
            selectedTab === "12231" ? "bg-blue-600 text-white" : "text-gray-800",
          )}
          onClick={() => setSelectedTab("12231")}
        >
          12231
        </button>
        <button
          className={cn(
            "px-4 py-3 text-lg font-medium",
            selectedTab === "Table 4" ? "bg-blue-600 text-white" : "text-gray-800",
          )}
          onClick={() => setSelectedTab("Table 4")}
        >
          Table 4
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-col border-b">
        {/* Views header */}
        <div className="flex items-center p-4 border-b">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-md">
            <Menu className="h-5 w-5" />
            <span className="font-medium">Views</span>
          </button>
          <div className="flex items-center ml-6 gap-2">
            <Grid className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Grid view</span>
            <Users className="h-5 w-5 ml-2" />
            <ChevronDown className="h-5 w-5 ml-1" />
          </div>
        </div>

        {/* Search and views */}
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Find a view" className="w-full pl-10 pr-4 py-2 border rounded-md" />
          </div>

          <div className="bg-blue-50 rounded-md p-3 flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Grid className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Grid view</span>
            </div>
            <Check className="h-5 w-5 text-gray-600" />
          </div>

          {/* Create section */}
          <div className="mb-4">
            <button
              className="flex items-center justify-between w-full py-2"
              onClick={() => setCreateExpanded(!createExpanded)}
            >
              <span className="text-lg font-medium">Create...</span>
              <ChevronDown className="h-5 w-5" />
            </button>

            {createExpanded && (
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Grid className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Grid</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-orange-500 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" />
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" />
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                    <span className="font-medium">Calendar</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-purple-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                    </div>
                    <span className="font-medium">Gallery</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-green-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                      </svg>
                    </div>
                    <span className="font-medium">Kanban</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-red-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <polyline points="8 7 3 12 8 17" />
                        <polyline points="16 7 21 12 16 17" />
                      </svg>
                    </div>
                    <span className="font-medium">Timeline</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Team</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-blue-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </div>
                    <span className="font-medium">List</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-green-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="7" y1="4" x2="7" y2="20" />
                      </svg>
                    </div>
                    <span className="font-medium">Gantt</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Team</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">New section</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Team</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 text-pink-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>
                    <span className="font-medium">Form</span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="text-xl font-light">+</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
