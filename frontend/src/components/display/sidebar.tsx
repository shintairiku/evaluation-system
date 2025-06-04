'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { groups } from '@/components/constants/routes';
import clsx from 'clsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
/* 追加 import（react-icons/io5）*/
import {
  IoClipboard, IoPeople, IoCalendar, IoDocumentText, IoStatsChart,
  IoCheckmarkCircle, IoTime, IoOptions, IoCreate, IoPulse, IoEye,
  IoChatbubbles, IoRefresh
} from 'react-icons/io5';

/* 追記用スニペット */
export const iconMap: Record<string, React.ReactElement<{ size?: number }>> = {
  /* …既存マッピング… */

  /* ───────── Evaluation module ───────── */
  '/evaluation'              : <IoClipboard size={24} />,

  // Admin
  '/user-management'         : <IoPeople size={24} />,
  '/cycle-settings'          : <IoCalendar size={24} />,
  '/template-management'     : <IoDocumentText size={24} />,
  '/report'                  : <IoStatsChart size={24} />,
  '/system-logs'             : <IoClipboard size={24} />,

  // Supervisor
  '/goal-approval'           : <IoCheckmarkCircle size={24} />,
  '/midterm-check'           : <IoTime size={24} />,
  '/evaluation-feedback'     : <IoChatbubbles size={24} />,
  '/calibration'             : <IoOptions size={24} />,
  '/team-dashboard'          : <IoStatsChart size={24} />,

  // Employee
  '/goal-input'              : <IoCreate size={24} />,
  '/progress-update'         : <IoPulse size={24} />,
  '/self-review'             : <IoDocumentText size={24} />,
  '/evaluation-input'        : <IoCreate size={24} />,
  '/view-feedback'           : <IoEye size={24} />,
};

export default function Sidebar() {
  const pathname = usePathname();
  const selectedMenu = groups
    .flatMap(g => g.links)
    .find(l => pathname.startsWith(l.href));

  return (
    <div className="flex h-[calc(100vh-45px)]">
      <aside className="group w-[64px] hover:w-[250px] h-full bg-primary text-white relative transition-all duration-300 ease-in-out z-20">
        <ScrollArea className="h-full">
          <nav className="flex flex-col gap-2">
            {groups.map((g) => (
              <div key={g.title} className="border-b border-white/20 p-[8px]">
                {g.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={clsx(
                      'flex items-center p-[8px] rounded-lg text-sm',
                      pathname.startsWith(l.href)
                        ? 'bg-primary text-white hover:bg-primary/80'
                        : 'hover:bg-primary/80'
                    )}
                  >
                    <div className="text-white">
                      {iconMap[l.href]}
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity delay-100 ml-3 text-[15px] text-white font-semibold whitespace-nowrap">
                      {l.label}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
        <div className='absolute right-0 top-0 size-[36px] translate-x-full bg-primary'>
          <div className='size-[36px] bg-white' style={{ clipPath: 'circle(100% at 100% 100%)' }}></div>
        </div>
        <div className='absolute right-0 bottom-0 size-[36px] translate-x-full bg-primary'>
          <div className='size-[36px] bg-white' style={{ clipPath: 'circle(100% at 100% 0%)' }}></div>
        </div>
      </aside>

      <aside className="absolute left-[64px] w-[250px] h-full bg-white text-black shadow-[10px_0_10px_rgba(0,0,0,0.1)] z-10">
        <div className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-center gap-2">
            <p className="text-lg font-bold whitespace-nowrap text-center">{selectedMenu?.sublabel}</p>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-80px)]">
          {selectedMenu?.subLinks?.map((section) => (
            <div key={section.title} className="flex flex-col gap-2 p-[8px] py-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-primary">{section.title}</p>
                <div className='h-[1px] bg-primary flex-1'></div>
              </div>
              <div className="flex flex-col">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      "flex items-center gap-2 p-[8px] rounded-lg",
                      pathname === link.href
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-gray-100"
                    )}
                  >
                    <div className="text-foreground">
                      {iconMap[link.href]}
                    </div>
                    <span className="text-sm text-foreground whitespace-nowrap transition-opacity duration-300 group-hover:opacity-0">
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </aside>
    </div>
  );
}

