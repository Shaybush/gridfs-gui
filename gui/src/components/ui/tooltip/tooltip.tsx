'use client';

import { useId, useMemo, type FC } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { TooltipProps } from './tooltip.types';

/**
 * Custom tooltip Component
 *
 * A fully customizable tooltip component built on react-tooltip with:
 * - Framer Motion animations
 * - Design system integration
 * - Mobile and desktop support
 * - Full accessibility (ARIA labels, keyboard navigation)
 * - Hover and click support
 *
 * @example
 * ```tsx
 * <tooltip content="This is a helpful tooltip" position="top">
 *   <Button>Hover me</Button>
 * </tooltip>
 * ```
 *
 * @example
 * ```tsx
 * <tooltip
 *   content={<div>Custom <strong>JSX</strong> content</div>}
 *   position="auto"
 *   maxWidth="400px"
 * >
 *   <InfoIcon />
 * </tooltip>
 * ```
 */
export const Tooltip: FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  maxWidth = '300px',
  className,
  triggerClassName,
  delay = 150,
  animate = true,
  id: customId,
  ...rest
}) => {
  // Generate unique ID for accessibility
  const autoId = useId();
  const tooltipId = customId || `tooltip-${autoId}`;

  // Animation variants for Framer Motion
  const animationVariants = useMemo(
    () => ({
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    }),
    []
  );

  // Animation transition settings
  const transition = useMemo(
    () => ({
      duration: 0.15,
      ease: 'easeOut' as const,
    }),
    []
  );

  // Wrap content with Framer Motion if animation is enabled
  const tooltipContent = useMemo(() => {
    if (!animate) {
      return content;
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={animationVariants}
          transition={transition}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }, [content, animate, animationVariants, transition]);

  return (
    <>
      {/* Trigger Element with data-tooltip-id */}
      <span
        data-tooltip-id={tooltipId}
        className={clsx('inline-flex items-center', triggerClassName)}
        tabIndex={0}
        role="button"
        aria-describedby={tooltipId}
      >
        {children}
      </span>

      {/* React tooltip Component */}
      <ReactTooltip
        id={tooltipId}
        place={position}
        variant="light"
        delayShow={delay}
        className={clsx('custom-tooltip', className)}
        classNameArrow="custom-tooltip-arrow"
        style={{
          maxWidth,
          zIndex: 9999,
        }}
        // tooltip behavior
        clickable // Allow hovering over tooltip content
        // Accessibility
        role="tooltip"
        aria-live="polite"
        // Global event off - useful for click outside to close
        globalCloseEvents={{
          escape: true,
          clickOutsideAnchor: true,
        }}
        // Rest of react-tooltip props
        {...rest}
      >
        {tooltipContent}
      </ReactTooltip>
    </>
  );
};

Tooltip.displayName = 'Tooltip';
