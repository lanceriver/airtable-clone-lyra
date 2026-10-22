"use client";

import {
  observeElementOffset,
  useVirtualizer,
  type Virtualizer,
} from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  accumulateScaledWheel,
  computeScale,
  toScrollTop,
  toVirtualOffset,
  wheelDeltaToPixels,
  type ScrollScale,
} from "./scrollScale";

type Options = {
  scrollRef: RefObject<HTMLDivElement | null>;
  count: number;
  rowHeight: number;
  /** Height of the sticky header inside the scroll container. */
  headerHeight: number;
  /** Largest spacer height; taller tables scroll scaled. */
  cap: number;
  overscan: number;
};

type ScaledVirtualizer = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scale: ScrollScale;
};

/**
 * TanStack Virtual for fixed-size rows in a scroll container whose spacer is
 * capped at `cap` px. The virtualizer works in virtual offsets (positions in
 * the full-height table): `observeElementOffset` reports `scrollTop * ratio`
 * and `scrollToFn` scrolls to `offset / ratio`. Under the cap the ratio is 1
 * and this is the stock virtualizer. See scrollScale.ts.
 */
export function useScaledVirtualizer({
  scrollRef,
  count,
  rowHeight,
  headerHeight,
  cap,
  overscan,
}: Options): ScaledVirtualizer {
  // Height of the part of the viewport that shows rows.
  const [viewportHeight, setViewportHeight] = useState(0);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () =>
      setViewportHeight(Math.max(0, element.clientHeight - headerHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef, headerHeight]);

  const scale = useMemo(
    () => computeScale({ total: count, rowHeight, viewportHeight, cap }),
    [count, rowHeight, viewportHeight, cap],
  );
  // The virtualizer's callbacks outlive renders; they read the latest scale.
  const scaleRef = useRef(scale);
  useLayoutEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const reportOffset = useRef<
    ((offset: number, isScrolling: boolean) => void) | null
  >(null);

  const observeOffset = useCallback(
    (
      instance: Virtualizer<HTMLDivElement, Element>,
      cb: (offset: number, isScrolling: boolean) => void,
    ) => {
      reportOffset.current = cb;
      const stop = observeElementOffset(instance, (scrollTop, isScrolling) =>
        cb(toVirtualOffset(scaleRef.current, scrollTop), isScrolling),
      );
      return () => {
        reportOffset.current = null;
        stop?.();
      };
    },
    [],
  );

  const scrollToFn = useCallback(
    (
      offset: number,
      options: { adjustments?: number; behavior?: ScrollBehavior },
      instance: Virtualizer<HTMLDivElement, Element>,
    ) => {
      // Same as the library's `elementScroll`, in real scroll pixels.
      instance.scrollElement?.scrollTo?.({
        top: toScrollTop(scaleRef.current, offset + (options.adjustments ?? 0)),
        behavior: options.behavior,
      });
    },
    [],
  );

  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollRef.current,
    overscan,
    observeElementOffset: observeOffset,
    scrollToFn,
  });

  // A new ratio (resize, or the row count changed) moves the virtual offset
  // without any scroll event: tell the virtualizer.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !reportOffset.current) return;
    reportOffset.current(toVirtualOffset(scale, element.scrollTop), false);
  }, [scale, scrollRef]);

  useScaledWheel(scrollRef, scale);

  return { virtualizer, scale };
}

/**
 * Wheel scrolling at the pace of the rows. Scrolled natively, a scaled table
 * moves `ratio` times faster than the wheel (a wheel pixel is a scroll pixel,
 * and a scroll pixel is `ratio` virtual pixels). So when scaled, vertical
 * wheel events are taken over: `scrollTop += delta / ratio`, carrying the
 * fraction between events. Horizontal gestures stay with the browser.
 */
function useScaledWheel(
  scrollRef: RefObject<HTMLDivElement | null>,
  { scaled, ratio }: ScrollScale,
) {
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !scaled) return;
    let remainder = 0;
    const onWheel = (event: WheelEvent) => {
      // Zoom (ctrl+wheel), shift+wheel (horizontal) and sideways swipes.
      if (event.ctrlKey || event.shiftKey || event.deltaY === 0) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      // Cancelling the event cancels its horizontal part too: redo that here.
      event.preventDefault();
      const page = element.clientHeight;
      const step = accumulateScaledWheel(
        remainder,
        wheelDeltaToPixels(event.deltaY, event.deltaMode, page),
        ratio,
      );
      remainder = step.remainder;
      element.scrollTop += step.scrollBy;
      if (event.deltaX !== 0) {
        element.scrollLeft += wheelDeltaToPixels(
          event.deltaX,
          event.deltaMode,
          element.clientWidth,
        );
      }
    };
    // Not passive: it has to cancel the browser's own scrolling.
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [scrollRef, scaled, ratio]);
}
