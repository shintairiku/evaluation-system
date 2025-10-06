'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { groups } from '@/components/constants/routes';
import clsx from 'clsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useGoalReviewContext } from '@/context/GoalReviewContext';
import {
  Home, Target, ClipboardList, List, Users, CheckCircle, MessageSquare,
  UserCog, Building, TrendingUp, Brain, Bell, Settings, Shield, Calendar
} from 'lucide-react';

// Link interface to match the structure from routes.ts
interface SidebarLink {
  href: string;
  label: string;
  sublabel: string;
  icon: string;
  permission: string;
}

// アイコンマッピング
const iconMap: Record<string, React.ReactElement> = {
  'home': <Home size={20} />,
  'target': <Target size={20} />,
  'clipboard': <ClipboardList size={20} />,
  'list': <List size={20} />,
  'users': <Users size={20} />,
  'check-circle': <CheckCircle size={20} />,
  'message-square': <MessageSquare size={20} />,
  'user-cog': <UserCog size={20} />,
  'building': <Building size={20} />,
  'calendar': <Calendar size={20} />,
  'trending-up': <TrendingUp size={20} />,
  'brain': <Brain size={20} />,
  'bell': <Bell size={20} />,
  'settings': <Settings size={20} />,
  'shield': <Shield size={20} />,
};

export default function Sidebar() {
  const pathname = usePathname();

  // Get goal review context with graceful fallback
  // This follows the project pattern of defensive programming for contexts
  let pendingCount = 0;
  try {
    const context = useGoalReviewContext();
    pendingCount = context.pendingCount;
  } catch {
    // Context not available (e.g., during SSR or outside provider)
    // Use default value
    pendingCount = 0;
  }

  // 権限フィルタリング（現在はダミー実装）
  const filterByPermission = (links: SidebarLink[]) => {
    // TODO: 実際の権限チェックロジックを実装
    return links; // 現在は全て表示
  };

  return (
    <aside className="group fixed left-0 top-[45px] w-[64px] hover:w-[280px] h-[calc(100vh-45px)] bg-primary overflow-hidden transition-all duration-300 ease-in-out z-40">
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building className="w-4 h-4 text-white" />
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">人事評価システム</h2>
          </div>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100%-80px)]">
        <nav className="p-2 space-y-4">
          {groups.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="px-2">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                  <h3 className="text-xs font-medium text-white/70 uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                  <Separator className="bg-white/20" />
                </div>
              </div>
              
              <div className="space-y-1">
                {filterByPermission(group.links).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                      pathname === link.href
                        ? 'bg-white/20 text-white'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <div className="flex-shrink-0 relative">
                      {iconMap[link.icon]}
                      {/* Goal Review Pending Count - Only visible when sidebar is collapsed */}
                      {link.href === '/goal-review' && pendingCount > 0 && (
                        <div className="absolute -top-1 -right-2 z-10 group-hover:opacity-0 transition-opacity duration-300">
                          <Badge variant="destructive" className="text-xs min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white border border-white/20">
                            {pendingCount > 99 ? '99' : pendingCount}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                      <div className="font-medium truncate">{link.label}</div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 flex items-center gap-2">
                      {/* Goal Review Count - Expanded view */}
                      {link.href === '/goal-review' && pendingCount > 0 && (
                        <Badge variant="destructive" className="text-xs bg-red-500 text-white">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </Badge>
                      )}

                      {link.permission === 'admin' && (
                        <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                          管理者
                        </Badge>
                      )}
                      {link.permission === 'supervisor' && (link.href !== '/goal-review' || pendingCount === 0) && (
                        <Badge variant="outline" className="text-xs border-white/30 text-white">
                          上司
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

