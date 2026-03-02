import { ReactNode } from 'react';
import type { ITooltip, PlacesType } from 'react-tooltip';

/**
 * tooltip position options
 */
export type TooltipPosition = PlacesType;

/**
 * Props for the custom tooltip component
 */
export interface TooltipProps extends Omit<ITooltip, 'children' | 'content' | 'place' | 'position'> {
  /**
   * The content to display inside the tooltip
   * Supports text, JSX, or any React component
   */
  content: ReactNode;

  /**
   * The trigger element that the tooltip is attached to
   */
  children: ReactNode;

  /**
   * tooltip placement position
   * @default 'top'
   */
  position?: TooltipPosition;

  /**
   * Maximum width of the tooltip content
   * @default '300px'
   */
  maxWidth?: string;

  /**
   * Additional CSS classes for custom styling (Tailwind or custom)
   */
  className?: string;

  /**
   * Delay before showing the tooltip (in milliseconds)
   * @default 150
   */
  delay?: number;

  /**
   * Enable or disable Framer Motion animations
   * @default true
   */
  animate?: boolean;

  /**
   * Custom ID for the tooltip (auto-generated if not provided)
   */
  id?: string;

  /**
   * Additional CSS classes for the trigger wrapper element
   */
  triggerClassName?: string;
}
