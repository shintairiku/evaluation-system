import { STAGE_HEIGHTS, TRANSITIONS, DRAG_STYLES, GRID_CONFIG } from '../constants';

/**
 * Utility functions for generating consistent CSS class names
 * Ensures type-safe and maintainable styling across stage management components
 */

/**
 * Generates CSS classes for stage card components
 * @param isExpanded - Whether the stage card is in expanded state
 * @param isMounted - Whether the component has been hydrated (SSR safety)
 * @param isOver - Whether a draggable item is currently over this droppable area
 * @param editMode - Whether the application is in edit mode
 * @returns Combined CSS class string
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

/**
 * Generates CSS classes for stage card header components
 * @param isExpanded - Whether the stage card is in expanded state
 * @returns Combined CSS class string for card header
 */
export function getCardHeaderClasses(isExpanded: boolean): string {
  const baseClasses = 'group pb-3 cursor-pointer hover:bg-gray-50 h-36 overflow-hidden';
  const transitionClass = TRANSITIONS.SMOOTH;
  const expandedClasses = !isExpanded ? 'pb-4' : '';

  return [
    baseClasses,
    transitionClass,
    expandedClasses,
  ].filter(Boolean).join(' ');
}

/**
 * Generates CSS classes for the responsive grid layout
 * @returns CSS class string for responsive grid container
 */
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