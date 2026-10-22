"use client";
import { UserDropdown } from "./UserDropdown";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CircleHelp, Users, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ColorPicker } from "~/app/_components/ui/ColorPicker";
import { useSession } from "next-auth/react";

type BaseNavbarProps = {
  baseName: string;
  baseId: string;
  userName: string;
  userImage: string;
  children?: React.ReactNode;
};

export function BaseNavbar({
  baseName,
  baseId,
  children,
  userName,
  userImage,
}: BaseNavbarProps) {
  return (
    <div className="sticky top-0 z-50">
      <div
        className={`flex w-full flex-row items-center justify-between bg-[#d54402] px-5 py-3`}
      >
        {/* Left group */}

        <div className="flex flex-row items-center gap-x-4">
          <Link href="/">
            <div className="group relative flex h-8 w-8 items-center justify-center">
              <Image
                width={22}
                height={22}
                src="/assets/airtable-white-icon.png"
                alt="white airtable icon"
                className="opacity-100 transition-opacity duration-200 group-hover:opacity-0"
                unoptimized
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  <ArrowLeft
                    className="h-5 w-5 text-gray-500"
                    strokeWidth={1}
                  />
                </div>
              </div>
            </div>
          </Link>
          <div className="flex flex-row items-center">
            <h1 className="text-1xl font-bold text-white">{baseName}</h1>
          </div>
          <div className="flex flex-row items-center gap-x-4">
            <button className="cursor-pointer rounded-full bg-[#B63A05] px-4 py-2 text-xs font-medium text-white inset-shadow-sm/20">
              Data
            </button>
            <button className="cursor-pointer rounded-full px-4 py-2 text-xs font-medium text-white hover:bg-[#B63A05]">
              Automations
            </button>
            <button className="cursor-pointer rounded-full px-4 py-2 text-xs font-medium text-white hover:bg-[#B63A05]">
              Interfaces
            </button>
            <button className="cursor-pointer rounded-full px-4 py-2 text-xs font-medium text-white hover:bg-[#B63A05]">
              Forms
            </button>
          </div>
        </div>
        {/* Right group */}
        <div className="flex flex-row items-center gap-x-2">
          <div className="flex flex-row items-center gap-x-2 rounded-full px-4 py-2 hover:bg-[#B63A05]">
            <CircleHelp className="h-4 w-4 cursor-pointer text-white" />
            <button className="cursor-pointer text-xs font-medium text-white">
              Help
            </button>
          </div>
          <div className="flex flex-row items-center gap-x-2 rounded-full bg-white px-4 py-2">
            <Users className="h-4 w-4 cursor-pointer text-[#B63A05]" />
            <button className="cursor-pointer text-xs font-medium text-[#B63A05]">
              Share
            </button>
          </div>
          <div className="flex flex-row items-center rounded-full bg-white px-2 py-2">
            <Bell className="h-4 w-4 cursor-pointer text-[#B63A05]" />
          </div>
          <UserDropdown userName={userName} userImage={userImage} />
        </div>
      </div>
      {children}
    </div>
  );
}
