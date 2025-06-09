"use client"
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
}

export function BaseNavbar({ baseName, baseId, children, userName, userImage }: BaseNavbarProps) {


    return (
        <div className="sticky top-0 z-50">
            <div className={`w-full px-5 py-3 flex flex-row justify-between items-center bg-[#d54402]`}>
                {/* Left group */}
            
            <div className="flex flex-row items-center gap-x-4">
                <Link href="/">
                    <div className="relative group w-8 h-8 flex items-center justify-center">
                        <Image
                        width={22}
                        height={22}
                        src="/assets/airtable-white-icon.png"
                        alt="white airtable icon"
                        className="opacity-100 transition-opacity duration-200 group-hover:opacity-0"
                        unoptimized
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-white rounded-full w-8 h-8 flex items-center justify-center">
                            <ArrowLeft className="text-gray-500 w-5 h-5" strokeWidth={1} />
                        </div>
                        </div>
                    </div>
                </Link>
                <div className="flex flex-row items-center">
                    <h1 className="text-1xl text-white font-bold">{baseName}</h1>
                </div>
                <div className="flex flex-row items-center gap-x-4">
                    <button className="cursor-pointer text-xs font-medium rounded-full bg-[#B63A05] inset-shadow-sm/20 px-4 py-2 text-white ">Data</button>
                    <button className="cursor-pointer text-xs font-medium rounded-full hover:bg-[#B63A05] px-4 py-2  text-white">Automations</button>
                    <button className="cursor-pointer text-xs font-medium rounded-full hover:bg-[#B63A05] px-4 py-2 text-white">Interfaces</button>
                    <button className="cursor-pointer text-xs font-medium rounded-full hover:bg-[#B63A05] px-4 py-2 text-white">Forms</button>
                </div>
            </div>
            {/* Right group */}
            <div className="flex flex-row items-center gap-x-2">
                <div className="flex flex-row items-center gap-x-2 rounded-full hover:bg-[#B63A05] px-4 py-2">
                    <CircleHelp className="w-4 h-4 text-white cursor-pointer" />
                    <button className="cursor-pointer text-xs font-medium text-white">Help</button>
                </div>  
                <div className="flex flex-row items-center gap-x-2 bg-white rounded-full px-4 py-2">
                    <Users className="w-4 h-4 text-[#B63A05] cursor-pointer" />
                    <button className="cursor-pointer text-xs font-medium text-[#B63A05]">Share</button>
                </div>
                <div className="flex flex-row items-center bg-white rounded-full px-2 py-2">
                    <Bell className="w-4 h-4 text-[#B63A05] cursor-pointer" />
                </div>
                <UserDropdown userName={userName} userImage={userImage}/>
            </div>
            </div>
            {children}
        </div>
    );
}