import { STAGE_HEIGHTS, TRANSITIONS, DRAG_STYLES, GRID_CONFIG } from '../constants';

/**
 * Utility functions for generating consistent class names
 */

export function getStageCardClasses(isExpanded: boolean, isMounted: boolean, isOver: boolean, editMode: boolean): string {
  const baseClasses = 'flex flex-col';
  const heightClass = `min-h-[${isExpanded ? STAGE_HEIGHTS.EXPANDED : STAGE_HEIGHTS.COLLAPSED}px]`;
  const transitionClass = TRANSITIONS.DEFAULT;
  
  const dragClasses = isMounted && isOver ? DRAG_STYLES.HOVER : '';
  const editModeClasses = editMode ? DRAG_STYLES.EDIT_MODE : '';

  return [
    heightClass,
    baseClasses,
    transitionClass,
    dragClasses,
    editModeClasses,
  ].filter(Boolean).join(' ');
}

export function getCardHeaderClasses(isExpanded: boolean): string {
  const baseClasses = 'pb-3 cursor-pointer hover:bg-gray-50';
  const transitionClass = TRANSITIONS.SMOOTH;
  const expandedClasses = !isExpanded ? 'pb-4' : '';

  return [
    baseClasses,
    transitionClass,
    expandedClasses,
  ].filter(Boolean).join(' ');
}

export function getGridClasses(): string {
  return [
    'grid',
    GRID_CONFIG.COLUMNS.BASE,
    GRID_CONFIG.COLUMNS.MD,
    GRID_CONFIG.COLUMNS.LG, 
    GRID_CONFIG.COLUMNS.XL,
    GRID_CONFIG.GAP,
    GRID_CONFIG.ALIGNMENT,
  ].join(' ');
}