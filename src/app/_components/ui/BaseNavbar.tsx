"use client"
import { UserDropdown } from "./UserDropdown";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { ColorPicker } from "~/app/_components/ui/ColorPicker";

type BaseNavbarProps = {
    baseName: string;
    baseId: string;
    children?: React.ReactNode;
}

export function BaseNavbar({ baseName, baseId, children }: BaseNavbarProps) {
    const colorOptions = [
        "bg-blue-700",
        "bg-red-700",
        "bg-green-700",
        "bg-orange-700",
        "bg-amber-700",
        "bg-purple-700"
    ];
    const [navbarColor, setNavbarColor] = useState("bg-purple-400");

    // Read from localStorage after mount (client only)
    useEffect(() => {
        const stored = localStorage.getItem(`navbarColor-${baseId}`);
        if (stored && colorOptions.includes(stored)) {
            setNavbarColor(stored);
        }
    }, [baseId]);


    useEffect(() => {
        localStorage.setItem(`navbarColor-${baseId}`, navbarColor);
    }, [navbarColor, baseId]);

    return (
        <div className="sticky top-0 z-50">
            <div className={`w-full px-5 py-3 flex flex-row justify-between items-center ${navbarColor}`}>
                {/* Left group */}
            
            <div className="flex flex-row items-center gap-x-2">
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
                    <h1 className="text-lg text-white font-normal">{baseName}</h1>
                    <ColorPicker selectedColor={navbarColor} setSelectedColor={setNavbarColor} colorOptions={colorOptions} baseName={baseName}/>
                </div>
                
                <Button variant="ghost" className="text-xs rounded-md bg-inherit text-white ">Data</Button>
                <Button variant="ghost" className="text-xs rounded-md bg-inherit  text-white">Automations</Button>
                <Button variant="ghost" className="text-xs rounded-md bg-inherit  text-white">Interfaces</Button>
                <Button variant="ghost" className="text-xs rounded-md bg-inherit  text-white">Forms</Button>
            </div>
            {/* Right group */}
            <div className="flex flex-row items-center gap-x-3">
                <Button variant="ghost" className="text-xs rounded-md bg-inherit  text-white">Share</Button>
                <Button variant="ghost" className="text-xs rounded-md bg-inherit  text-white">Settings</Button>
                <UserDropdown userName="John Doe" userImage="/assets/user_image.png" />
            </div>
            </div>
            {children}
        </div>
    );
}