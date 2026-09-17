"use client"

import { useCallback, useRef } from "react"
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react"

const DRAG_THRESHOLD_PX = 5

/**
 * Arrastar-para-rolar horizontal em um container com overflow-x.
 * Só mouse/pen — touch mantém o scroll nativo. Um arrasto acima do
 * threshold suprime o click seguinte, para não disparar o toggle do
 * filtro ao soltar o botão sobre um chip.
 */
export function useDragScroll<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startScrollLeftRef = useRef(0)
  const draggedRef = useRef(false)

  const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
    if (event.pointerType === "touch" || event.button !== 0) return
    const container = containerRef.current
    if (!container || container.scrollWidth <= container.clientWidth) return
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startScrollLeftRef.current = container.scrollLeft
    draggedRef.current = false
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    const container = containerRef.current
    if (!container || pointerIdRef.current !== event.pointerId) return
    const deltaX = event.clientX - startXRef.current
    if (!draggedRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return
      draggedRef.current = true
      container.setPointerCapture(event.pointerId)
    }
    container.scrollLeft = startScrollLeftRef.current - deltaX
  }, [])

  const endDrag = useCallback((event: ReactPointerEvent<T>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    const container = containerRef.current
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }
  }, [])

  const onClickCapture = useCallback((event: ReactMouseEvent<T>) => {
    if (!draggedRef.current) return
    draggedRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    ref: containerRef,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClickCapture,
  }
}
