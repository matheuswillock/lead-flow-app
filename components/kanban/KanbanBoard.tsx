"use client"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"

type Card = { id: string; title: string }
type Column = { id: string; title: string; cards: Card[] }

export default function KanbanBoard({ columns, onMove }: {
  columns: Column[]
  onMove: (result: DropResult) => void
}) {
  return (
    <DragDropContext onDragEnd={onMove}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => (
          <Droppable droppableId={col.id} key={col.id}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 p-3 rounded-xl border">
                <h3 className="font-medium">{col.title}</h3>
                {col.cards.map((card, idx) => (
                  <Draggable key={card.id} draggableId={card.id} index={idx}>
                    {(prov) => (
                      <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                        className="p-3 rounded-lg border bg-background">
                        {card.title}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  )
}
