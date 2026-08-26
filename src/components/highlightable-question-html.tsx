"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Eraser, Underline } from "lucide-react";

type AnnotationStyle = "yellow" | "blue" | "pink" | "underline";

export type TextAnnotation = {
  id: string;
  start: number;
  end: number;
  style: AnnotationStyle;
};

type ToolbarState = {
  start: number;
  end: number;
  left: number;
  top: number;
  annotationId?: string;
};

const annotationStyles: AnnotationStyle[] = ["yellow", "blue", "pink", "underline"];
const colorLabels: Record<Exclude<AnnotationStyle, "underline">, string> = {
  yellow: "Yellow",
  blue: "Blue",
  pink: "Pink",
};

function annotationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeAdjacent(annotations: TextAnnotation[]) {
  const sorted = annotations
    .filter((annotation) => annotation.start < annotation.end)
    .sort((first, second) => first.start - second.start || first.end - second.end);
  const merged: TextAnnotation[] = [];

  for (const annotation of sorted) {
    const previous = merged.at(-1);
    if (previous && previous.style === annotation.style && previous.end === annotation.start) {
      previous.end = annotation.end;
    } else {
      merged.push({ ...annotation });
    }
  }

  return merged;
}

export function replaceAnnotationRange(
  annotations: TextAnnotation[],
  start: number,
  end: number,
  style?: AnnotationStyle,
  id = annotationId(),
) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) return annotations;

  const next = annotations.flatMap((annotation) => {
    if (annotation.end <= start || annotation.start >= end) return [annotation];

    const fragments: TextAnnotation[] = [];
    if (annotation.start < start) fragments.push({ ...annotation, id: `${annotation.id}:before:${start}`, end: start });
    if (annotation.end > end) fragments.push({ ...annotation, id: `${annotation.id}:after:${end}`, start: end });
    return fragments;
  });

  if (style) next.push({ id, start, end, style });
  return mergeAdjacent(next);
}

function parseAnnotations(value: string | null, textLength: number): TextAnnotation[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return mergeAdjacent(parsed.flatMap((item): TextAnnotation[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<TextAnnotation>;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.start !== "number"
        || typeof candidate.end !== "number"
        || !annotationStyles.includes(candidate.style as AnnotationStyle)
      ) return [];
      const start = Math.max(0, Math.min(textLength, Math.floor(candidate.start)));
      const end = Math.max(0, Math.min(textLength, Math.floor(candidate.end)));
      return start < end ? [{ id: candidate.id, start, end, style: candidate.style as AnnotationStyle }] : [];
    }));
  } catch {
    return [];
  }
}

function textOffset(root: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function wrapAnnotation(root: HTMLElement, annotation: TextAnnotation) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: { node: Text; start: number; end: number }[] = [];
  let position = 0;
  let current: Node | null;

  while ((current = walker.nextNode())) {
    const node = current as Text;
    const nodeEnd = position + node.data.length;
    const start = Math.max(annotation.start, position);
    const end = Math.min(annotation.end, nodeEnd);
    if (start < end) segments.push({ node, start: start - position, end: end - position });
    position = nodeEnd;
    if (position >= annotation.end) break;
  }

  for (const segment of segments.reverse()) {
    const range = document.createRange();
    range.setStart(segment.node, segment.start);
    range.setEnd(segment.node, segment.end);
    const mark = document.createElement("mark");
    mark.className = `question-annotation question-annotation-${annotation.style}`;
    mark.dataset.annotationId = annotation.id;
    range.surroundContents(mark);
  }
}

function toolbarPosition(rect: DOMRect, root: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  const center = rect.left - rootRect.left + rect.width / 2;
  const safeCenter = rootRect.width < 256 ? rootRect.width / 2 : Math.min(Math.max(center, 128), rootRect.width - 128);
  return { left: safeCenter, top: rect.bottom - rootRect.top + 10 };
}

export function HighlightableQuestionHtml({
  html,
  storageKey,
  className = "",
}: {
  html?: string | null;
  storageKey: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !html) return;
    root.innerHTML = html;
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(`sat-grinder:highlights:${storageKey}`); } catch { /* Storage may be disabled by browser policy. */ }
    const restored = parseAnnotations(stored, root.textContent?.length ?? 0);
    setAnnotations(restored);
    setToolbar(null);
  }, [html, storageKey]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !html) return;
    root.innerHTML = html;
    for (const annotation of annotations) wrapAnnotation(root, annotation);
  }, [annotations, html]);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!rootRef.current?.parentElement?.contains(event.target as Node)) setToolbar(null);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  if (!html) return null;

  function showToolbar(event: React.PointerEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    window.setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        if (root.contains(range.startContainer) && root.contains(range.endContainer) && range.toString().trim()) {
          const start = textOffset(root, range.startContainer, range.startOffset);
          const end = textOffset(root, range.endContainer, range.endOffset);
          const rect = range.getBoundingClientRect();
          setToolbar({ start: Math.min(start, end), end: Math.max(start, end), ...toolbarPosition(rect, root) });
          return;
        }
      }

      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("mark[data-annotation-id]") : null;
      const existing = target ? annotations.find((annotation) => annotation.id === target.dataset.annotationId) : undefined;
      if (target && existing) {
        setToolbar({ start: existing.start, end: existing.end, annotationId: existing.id, ...toolbarPosition(target.getBoundingClientRect(), root) });
      } else {
        setToolbar(null);
      }
    });
  }

  function applyStyle(style?: AnnotationStyle) {
    if (!toolbar) return;
    setAnnotations((current) => {
      const updated = replaceAnnotationRange(current, toolbar.start, toolbar.end, style);
      try { sessionStorage.setItem(`sat-grinder:highlights:${storageKey}`, JSON.stringify(updated)); } catch { /* Highlighting still works without persistence. */ }
      return updated;
    });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    setAnnouncement(style ? `${style === "underline" ? "Underline" : `${colorLabels[style]} highlight`} applied.` : "Highlight removed.");
  }

  const selectedAnnotation = toolbar?.annotationId
    ? annotations.find((annotation) => annotation.id === toolbar.annotationId)
    : undefined;

  return <div className={`question-highlight-surface ${className}`}>
    <div
      ref={rootRef}
      className="question-html"
      onPointerUp={showToolbar}
      onKeyUp={(event) => event.key === "Escape" ? setToolbar(null) : showToolbar(event)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
    {toolbar && <div
      className="question-highlight-toolbar"
      role="toolbar"
      aria-label="Text highlight options"
      style={{ left: toolbar.left, top: toolbar.top }}
      onPointerDown={(event) => event.preventDefault()}
    >
      {(Object.keys(colorLabels) as Exclude<AnnotationStyle, "underline">[]).map((style) => <button
        key={style}
        type="button"
        className={`highlight-swatch highlight-swatch-${style}`}
        aria-label={`${colorLabels[style]} highlight`}
        aria-pressed={selectedAnnotation?.style === style}
        title={`${colorLabels[style]} highlight`}
        onClick={() => applyStyle(style)}
      />)}
      <span className="highlight-toolbar-divider" aria-hidden="true" />
      <button
        type="button"
        className="highlight-tool-button"
        aria-label="Underline"
        aria-pressed={selectedAnnotation?.style === "underline"}
        title="Underline"
        onClick={() => applyStyle("underline")}
      ><Underline className="size-4" /></button>
      <button type="button" className="highlight-tool-button" aria-label="Remove highlight" title="Remove highlight" onClick={() => applyStyle()}><Eraser className="size-4" /></button>
    </div>}
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </div>;
}
