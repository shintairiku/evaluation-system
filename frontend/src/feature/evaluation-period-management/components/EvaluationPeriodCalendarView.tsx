'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Target, Clock } from 'lucide-react';
import {
  getStatusLabel,
  getStatusColor,
  parseDateFromISO,
  formatDateForDisplay
} from '@/lib/evaluation-period-utils';
import type { EvaluationPeriodCalendarViewProps, CalendarViewMode } from '../types';
import type { EvaluationPeriod } from '@/api/types/evaluation-period';

export default function EvaluationPeriodCalendarView({
  periods,
  viewMode = 'month',
  onPeriodClick,
  onDateClick,
  onViewModeChange
}: EvaluationPeriodCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Navigation handlers
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const goToPreviousQuarter = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 3));
  };

  const goToNextQuarter = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 3));
  };

  const goToPreviousYear = () => {
    setCurrentDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth()));
  };

  const goToNextYear = () => {
    setCurrentDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth()));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get navigation functions based on view mode
  const getNavigationHandlers = () => {
    switch (viewMode) {
      case 'year':
        return {
          previous: goToPreviousYear,
          next: goToNextYear,
          label: `${currentYear}年`
        };
      case '3month':
        return {
          previous: goToPreviousQuarter,
          next: goToNextQuarter,
          label: `${currentYear}年 ${Math.floor(currentMonth / 3) + 1}Q`
        };
      default:
        return {
          previous: goToPreviousMonth,
          next: goToNextMonth,
          label: currentDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long'
          })
        };
    }
  };

  // Get periods that overlap with a specific date range
  const getPeriodsForDateRange = (startDate: Date, endDate: Date): EvaluationPeriod[] => {
    return periods.filter(period => {
      const periodStart = parseDateFromISO(period.start_date);
      const periodEnd = parseDateFromISO(period.end_date);

      // Check if period overlaps with date range
      return (periodStart <= endDate && periodEnd >= startDate);
    });
  };

  // Get periods that overlap with current month
  const getPeriodsForMonth = (year: number = currentYear, month: number = currentMonth): EvaluationPeriod[] => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    return getPeriodsForDateRange(monthStart, monthEnd);
  };

  // Generate calendar days for a specific month
  const generateCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  // Check if a date has periods or deadlines
  const getDateInfo = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const monthPeriods = getPeriodsForMonth(year, month);

    const periodsForDate = monthPeriods.filter(period => {
      const periodStart = parseDateFromISO(period.start_date);
      const periodEnd = parseDateFromISO(period.end_date);
      return date >= periodStart && date <= periodEnd;
    });

    // Helper function to compare dates by day, ignoring time
    const isSameDate = (date1: Date, date2: Date) => {
      return date1.getFullYear() === date2.getFullYear() &&
             date1.getMonth() === date2.getMonth() &&
             date1.getDate() === date2.getDate();
    };

    // Check for goal submission deadlines
    const hasGoalDeadline = monthPeriods.some(period => {
      const goalDeadline = parseDateFromISO(period.goal_submission_deadline);
      return isSameDate(goalDeadline, date);
    });

    // Check for evaluation deadlines
    const hasEvalDeadline = monthPeriods.some(period => {
      const evalDeadline = parseDateFromISO(period.evaluation_deadline);
      return isSameDate(evalDeadline, date);
    });

    return {
      periods: periodsForDate,
      hasGoalDeadline,
      hasEvalDeadline
    };
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const { previous, next, label } = getNavigationHandlers();

  // Render single month calendar
  const renderMonthCalendar = (year: number, month: number, isCompact = false) => {
    const calendarDays = generateCalendarDays(year, month);
    const monthName = new Date(year, month).toLocaleDateString('ja-JP', { month: 'long' });

    return (
      <div className={`space-y-2 ${isCompact ? '' : 'space-y-4'}`}>
        {isCompact && (
          <h3 className="text-sm font-semibold text-center text-gray-900">
            {monthName}
          </h3>
        )}

        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div
              key={`weekday-${day}`}
              className={`text-center font-medium text-gray-500 ${
                isCompact ? 'text-xs p-1' : 'text-sm p-2'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className={isCompact ? 'h-8' : 'h-24 p-2'}
                />
              );
            }

            const dateInfo = getDateInfo(year, month, day);
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === month &&
              new Date().getFullYear() === year;

            const dayClassName = `
              border border-gray-200 cursor-pointer hover:bg-gray-50
              ${isToday ? 'bg-blue-50 border-blue-300' : ''}
              ${dateInfo.hasGoalDeadline ? 'ring-2 ring-amber-300' : ''}
              ${dateInfo.hasEvalDeadline ? 'ring-2 ring-red-300' : ''}
              ${isCompact ? 'h-8 text-xs' : 'h-24 p-2'}
            `;

            return (
              <div
                key={`day-${day}`}
                className={dayClassName}
                onClick={() => onDateClick(new Date(year, month, day))}
              >
                <div className={`font-medium text-gray-900 ${isCompact ? 'text-center' : 'mb-1'}`}>
                  {day}
                </div>

                {!isCompact && (
                  <div className="space-y-1">
                    {/* Period indicators */}
                    {dateInfo.periods.slice(0, 2).map(period => (
                      <div
                        key={period.id}
                        className={`
                          text-xs px-1 py-0.5 rounded cursor-pointer truncate
                          ${getStatusColor(period.status)}
                          hover:opacity-80
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPeriodClick(period);
                        }}
                        title={period.name}
                      >
                        {period.name}
                      </div>
                    ))}

                    {dateInfo.periods.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dateInfo.periods.length - 2} more
                      </div>
                    )}

                    {/* Deadline indicators */}
                    {dateInfo.hasGoalDeadline && (
                      <div className="flex items-center text-xs text-amber-600">
                        <Target size={10} className="mr-1" />
                        <span>目標締切</span>
                      </div>
                    )}

                    {dateInfo.hasEvalDeadline && (
                      <div className="flex items-center text-xs text-red-600">
                        <Clock size={10} className="mr-1" />
                        <span>評価締切</span>
                      </div>
                    )}
                  </div>
                )}

                {isCompact && (
                  <div className="relative">
                    {/* Period indicator dot */}
                    {dateInfo.periods.length > 0 && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                    {/* Goal deadline indicator */}
                    {dateInfo.hasGoalDeadline && (
                      <div className="absolute top-0 left-0 w-2 h-2 bg-amber-500 rounded-full"></div>
                    )}
                    {/* Evaluation deadline indicator */}
                    {dateInfo.hasEvalDeadline && (
                      <div className="absolute bottom-0 left-0 w-2 h-2 bg-red-500 rounded-full"></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render 3-month view
  const render3MonthView = () => {
    const startMonth = Math.floor(currentMonth / 3) * 3;
    const months = [
      { year: currentYear, month: startMonth },
      { year: currentYear, month: startMonth + 1 },
      { year: currentYear, month: startMonth + 2 }
    ].map(({ year, month }) => ({
      year: month > 11 ? year + 1 : year,
      month: month > 11 ? month - 12 : month
    }));

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {months.map(({ year, month }) => (
          <Card key={`${year}-${month}`}>
            <CardContent className="p-4">
              {renderMonthCalendar(year, month, true)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Render yearly view
  const renderYearlyView = () => {
    const months = Array.from({ length: 12 }, (_, i) => ({ year: currentYear, month: i }));

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {months.map(({ year, month }) => (
          <Card
            key={`${year}-${month}`}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setCurrentDate(new Date(year, month));
              onViewModeChange?.('3month');
            }}
          >
            <CardContent className="p-3">
              {renderMonthCalendar(year, month, true)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Get periods for current view
  const getCurrentPeriods = () => {
    switch (viewMode) {
      case 'year':
        return getPeriodsForDateRange(
          new Date(currentYear, 0, 1),
          new Date(currentYear, 11, 31)
        );
      case '3month':
        const startMonth = Math.floor(currentMonth / 3) * 3;
        return getPeriodsForDateRange(
          new Date(currentYear, startMonth, 1),
          new Date(currentYear, startMonth + 3, 0)
        );
      default:
        return getPeriodsForMonth();
    }
  };

  const currentPeriods = getCurrentPeriods();

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {label}
          </h2>

          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['month', '3month', 'year'] as CalendarViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange?.(mode)}
                className="text-xs px-3 py-1"
              >
                {mode === 'month' && '月'}
                {mode === '3month' && '3ヶ月'}
                {mode === 'year' && '年'}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={goToToday}>
            今日
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previous}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={next}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      {viewMode === 'year' && renderYearlyView()}
      {viewMode === '3month' && render3MonthView()}
      {viewMode === 'month' && (
        <Card>
          <CardContent className="p-4">
            {renderMonthCalendar(currentYear, currentMonth)}
          </CardContent>
        </Card>
      )}

      {/* Period Legend */}
      {currentPeriods.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar size={16} />
              {viewMode === 'year' ? 'この年の評価期間' :
               viewMode === '3month' ? 'この四半期の評価期間' : 'この月の評価期間'}
            </h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {currentPeriods.map(period => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => onPeriodClick(period)}
                >
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {period.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateForDisplay(period.start_date)} ～ {formatDateForDisplay(period.end_date)}
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Target size={10} />
                        目標: {formatDateForDisplay(period.goal_submission_deadline)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={10} />
                        評価: {formatDateForDisplay(period.evaluation_deadline)}
                      </div>
                    </div>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(period.status)}`}>
                    {getStatusLabel(period.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {currentPeriods.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">
              {viewMode === 'year' ? 'この年には評価期間がありません' :
               viewMode === '3month' ? 'この四半期には評価期間がありません' : 'この月には評価期間がありません'}
            </p>
            <p className="text-sm text-gray-400">
              日付をクリックして新しい評価期間を作成することができます
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}