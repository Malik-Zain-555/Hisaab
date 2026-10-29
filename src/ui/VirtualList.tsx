import React, { useState, useRef, useCallback, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  estimateRowHeight?: number;
  overscan?: number;
  threshold?: number;
  maxHeight?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
}

/**
 * Lightweight virtualized list container for History and Chat messages.
 * Below `threshold` items, renders inline without scroll nesting; above threshold,
 * mounts only visible rows + overscan to keep DOM node count small and frame times < 16ms.
 */
export function VirtualList<T>({
  items,
  estimateRowHeight = 76,
  overscan = 6,
  threshold = 24,
  maxHeight = 620,
  className = '',
  getKey,
  renderItem,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const range = useMemo(() => {
    if (items.length <= threshold) {
      return { start: 0, end: items.length, topPad: 0, bottomPad: 0 };
    }
    const visibleCount = Math.ceil(maxHeight / estimateRowHeight);
    const rawStart = Math.floor(scrollTop / estimateRowHeight);
    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(items.length, rawStart + visibleCount + overscan);
    const topPad = start * estimateRowHeight;
    const bottomPad = Math.max(0, (items.length - end) * estimateRowHeight);
    return { start, end, topPad, bottomPad };
  }, [items.length, threshold, maxHeight, estimateRowHeight, scrollTop, overscan]);

  if (items.length <= threshold) {
    return (
      <div className={className}>
        {items.map((item, idx) => (
          <React.Fragment key={getKey(item, idx)}>{renderItem(item, idx)}</React.Fragment>
        ))}
      </div>
    );
  }

  const slice = items.slice(range.start, range.end);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{ maxHeight, overflowY: 'auto' }}
      className={className}
    >
      {range.topPad > 0 && <div style={{ height: range.topPad }} aria-hidden="true" />}
      {slice.map((item, localIdx) => {
        const idx = range.start + localIdx;
        return <React.Fragment key={getKey(item, idx)}>{renderItem(item, idx)}</React.Fragment>;
      })}
      {range.bottomPad > 0 && <div style={{ height: range.bottomPad }} aria-hidden="true" />}
    </div>
  );
}
