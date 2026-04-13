'use client'

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BlockGroupItem, BlockItem } from '@maily-to/core/blocks'
import {
  blockquote,
  bulletList,
  button,
  columns,
  divider,
  heading1,
  heading2,
  heading3,
  htmlCodeBlock,
  image,
  inlineImage,
  linkCard,
  logo,
  orderedList,
  repeat,
  section,
  spacer,
  text,
} from '@maily-to/core/blocks'
import { getSlashCommandSuggestions, SlashCommandExtension } from '@maily-to/core/extensions'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import {
  AlignLeft,
  Columns3,
  Heading1 as Heading1Icon,
  Heading2 as Heading2Icon,
  Heading3 as Heading3Icon,
  ImageIcon,
  List,
  ListOrdered,
  MousePointer2,
  Quote,
  RectangleHorizontal,
  SeparatorHorizontal,
  Space,
  SquareCode,
  Type,
} from 'lucide-react'
import tippy from 'tippy.js'

type SlashCommandListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

type SlashCommandListProps = {
  items: BlockGroupItem[]
  command: (item: BlockItem) => void
}

function cloneCommand(command: BlockItem, overrides: Partial<BlockItem>): BlockItem {
  return {
    ...command,
    ...overrides,
    searchTerms: overrides.searchTerms ?? command.searchTerms,
  } as BlockItem
}

function iconClassName(title: string): string {
  if (title === 'Title' || title === 'Subtitle' || title === 'Heading') {
    return 'h-3.5 w-3.5 text-zinc-300'
  }

  return 'h-4 w-4 text-zinc-400'
}

function renderCommandIcon(item: BlockItem) {
  switch (item.title) {
    case 'Text':
      return <AlignLeft className={iconClassName(item.title)} />
    case 'Title':
      return <Heading1Icon className={iconClassName(item.title)} />
    case 'Subtitle':
      return <Heading2Icon className={iconClassName(item.title)} />
    case 'Heading':
      return <Heading3Icon className={iconClassName(item.title)} />
    case 'Bullet list':
      return <List className={iconClassName(item.title)} />
    case 'Numbered list':
      return <ListOrdered className={iconClassName(item.title)} />
    case 'Quote':
      return <Quote className={iconClassName(item.title)} />
    case 'Code block':
      return <SquareCode className={iconClassName(item.title)} />
    case 'Image':
      return <ImageIcon className={iconClassName(item.title)} />
    case 'Logo':
      return <Type className={iconClassName(item.title)} />
    case 'Inline image':
      return <ImageIcon className={iconClassName(item.title)} />
    case 'Columns':
      return <Columns3 className={iconClassName(item.title)} />
    case 'Section':
      return <RectangleHorizontal className={iconClassName(item.title)} />
    case 'Repeat':
      return <MousePointer2 className={iconClassName(item.title)} />
    case 'Divider':
      return <SeparatorHorizontal className={iconClassName(item.title)} />
    case 'Spacer':
      return <Space className={iconClassName(item.title)} />
    case 'Button':
      return <MousePointer2 className={iconClassName(item.title)} />
    case 'Link card':
      return <RectangleHorizontal className={iconClassName(item.title)} />
    default:
      return item.icon ?? <Type className={iconClassName(item.title)} />
  }
}

const textCommands: BlockItem[] = [
  cloneCommand(text, {
    title: 'Text',
    searchTerms: ['text', 'paragraph', 'copy'],
  }),
  cloneCommand(heading1, {
    title: 'Title',
    searchTerms: ['title', 'h1', 'heading 1'],
  }),
  cloneCommand(heading2, {
    title: 'Subtitle',
    searchTerms: ['subtitle', 'h2', 'heading 2'],
  }),
  cloneCommand(heading3, {
    title: 'Heading',
    searchTerms: ['heading', 'h3', 'title 3'],
  }),
  cloneCommand(bulletList, {
    title: 'Bullet list',
    searchTerms: ['bullet', 'list', 'unordered'],
  }),
  cloneCommand(orderedList, {
    title: 'Numbered list',
    searchTerms: ['numbered', 'ordered', 'list'],
  }),
  cloneCommand(blockquote, {
    title: 'Quote',
    searchTerms: ['quote', 'blockquote', 'citation'],
  }),
  cloneCommand(htmlCodeBlock, {
    title: 'Code block',
    description: 'Add a code block.',
    searchTerms: ['code', 'code block', 'html', 'custom html'],
  }),
]

const mediaCommands: BlockItem[] = [
  cloneCommand(image, {
    title: 'Image',
    searchTerms: ['image', 'photo', 'media'],
  }),
  cloneCommand(logo, {
    title: 'Logo',
    searchTerms: ['logo', 'brand'],
  }),
  cloneCommand(inlineImage, {
    title: 'Inline image',
    searchTerms: ['inline image', 'inline photo'],
  }),
]

const layoutCommands: BlockItem[] = [
  cloneCommand(columns, {
    title: 'Columns',
    searchTerms: ['columns', 'layout', 'grid'],
  }),
  cloneCommand(section, {
    title: 'Section',
    searchTerms: ['section', 'container'],
  }),
  cloneCommand(repeat, {
    title: 'Repeat',
    searchTerms: ['repeat', 'loop'],
  }),
  cloneCommand(divider, {
    title: 'Divider',
    searchTerms: ['divider', 'separator', 'line'],
  }),
  cloneCommand(spacer, {
    title: 'Spacer',
    searchTerms: ['spacer', 'space', 'gap'],
  }),
]

const actionCommands: BlockItem[] = [
  cloneCommand(button, {
    title: 'Button',
    searchTerms: ['button', 'cta', 'action'],
  }),
  cloneCommand(linkCard, {
    title: 'Link card',
    searchTerms: ['link card', 'card', 'link'],
  }),
]

export const resendMailyBlocks: BlockGroupItem[] = [
  {
    title: 'Text',
    commands: textCommands,
  },
  {
    title: 'Media',
    commands: mediaCommands,
  },
  {
    title: 'Layout',
    commands: layoutCommands,
  },
  {
    title: 'Actions',
    commands: actionCommands,
  },
]

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(function SlashCommandList(
  { command, items: groups },
  ref
) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const flattenedItems = useMemo(() => {
    return groups.flatMap((group, groupIndex) =>
      group.commands.map((_, commandIndex) => ({
        groupIndex,
        commandIndex,
      }))
    )
  }, [groups])

  const activeFlatIndex = useMemo(() => {
    return flattenedItems.findIndex(
      (entry) => entry.groupIndex === selectedGroupIndex && entry.commandIndex === selectedCommandIndex
    )
  }, [flattenedItems, selectedCommandIndex, selectedGroupIndex])

  const selectItem = (groupIndex: number, commandIndex: number) => {
    const item = groups[groupIndex]?.commands[commandIndex]
    if (!item) return
    command(item)
  }

  const moveSelection = (direction: 1 | -1) => {
    if (flattenedItems.length === 0) return false

    const nextIndex =
      activeFlatIndex === -1
        ? 0
        : (activeFlatIndex + direction + flattenedItems.length) % flattenedItems.length

    const nextItem = flattenedItems[nextIndex]
    if (!nextItem) return false

    setSelectedGroupIndex(nextItem.groupIndex)
    setSelectedCommandIndex(nextItem.commandIndex)
    return true
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        return moveSelection(-1)
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        return moveSelection(1)
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (activeFlatIndex === -1) return false
        const activeItem = flattenedItems[activeFlatIndex]
        selectItem(activeItem.groupIndex, activeItem.commandIndex)
        return true
      }

      return false
    },
  }))

  useEffect(() => {
    setSelectedGroupIndex(0)
    setSelectedCommandIndex(0)
  }, [groups])

  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    const activeElement = activeItemRef.current

    if (!container || !activeElement) return

    const activeTop = activeElement.offsetTop
    const activeBottom = activeTop + activeElement.offsetHeight
    const viewportTop = container.scrollTop
    const viewportBottom = viewportTop + container.clientHeight

    if (activeTop < viewportTop) {
      container.scrollTop = activeTop - 12
      return
    }

    if (activeBottom > viewportBottom) {
      container.scrollTop = activeBottom - container.clientHeight + 12
    }
  }, [activeFlatIndex])

  if (groups.length === 0 || flattenedItems.length === 0) {
    return null
  }

  return (
    <div className="maily-slash-menu">
      <div ref={scrollContainerRef} className="maily-slash-menu__scroll">
        {groups.map((group, groupIndex) => (
          <div key={group.title} className="maily-slash-menu__group">
            <div className="maily-slash-menu__label">{group.title}</div>
            <div className="maily-slash-menu__items">
              {group.commands.map((item, commandIndex) => {
                const itemKey = `${groupIndex}-${commandIndex}`
                const isSelected = groupIndex === selectedGroupIndex && commandIndex === selectedCommandIndex
                const isHovered = hoveredKey === itemKey

                return (
                  <button
                    key={itemKey}
                    ref={isSelected ? activeItemRef : null}
                    type="button"
                    className="maily-slash-menu__item"
                    data-selected={isSelected || isHovered ? 'true' : 'false'}
                    onMouseEnter={() => setHoveredKey(itemKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => selectItem(groupIndex, commandIndex)}
                  >
                    <span className="maily-slash-menu__icon">{renderCommandIcon(item)}</span>
                    <span className="maily-slash-menu__title">{item.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="maily-slash-menu__footer">
        <span className="maily-slash-menu__footer-text">
          <kbd className="maily-slash-menu__kbd">↑</kbd>
          <kbd className="maily-slash-menu__kbd">↓</kbd>
          to navigate
        </span>
        <span aria-hidden="true" className="maily-slash-menu__dot">
          ·
        </span>
        <span className="maily-slash-menu__footer-text">
          <kbd className="maily-slash-menu__kbd">Enter</kbd>
          to select
        </span>
      </div>
    </div>
  )
})

export function createResendSlashCommandExtension(blocks: BlockGroupItem[] = resendMailyBlocks) {
  const defaultSuggestion = getSlashCommandSuggestions(blocks)

  return SlashCommandExtension.configure({
    suggestion: {
      ...defaultSuggestion,
      render: () => {
        let component: ReactRenderer<SlashCommandListRef> | null = null
        let popup: ReturnType<typeof tippy> | null = null

        const getReferenceClientRect = (props: SuggestionProps<BlockGroupItem>) => {
          const rect = props.clientRect?.()
          return rect ?? new DOMRect()
        }

        return {
          onStart: (props: SuggestionProps<BlockGroupItem>) => {
            if (!props.clientRect) return

            component = new ReactRenderer(SlashCommandList, {
              props,
              editor: props.editor,
            })

            popup = tippy('body', {
              appendTo: () => document.body,
              content: component.element,
              getReferenceClientRect: () => getReferenceClientRect(props),
              interactive: true,
              placement: 'bottom-start',
              showOnCreate: true,
              theme: 'maily-slash',
              trigger: 'manual',
              zIndex: 70,
              offset: [0, 10],
              popperOptions: {
                modifiers: [
                  {
                    name: 'flip',
                    options: {
                      fallbackPlacements: ['top-start'],
                    },
                  },
                  {
                    name: 'preventOverflow',
                    options: {
                      boundary: 'viewport',
                      padding: 12,
                    },
                  },
                ],
              },
            })
          },
          onUpdate: (props: SuggestionProps<BlockGroupItem>) => {
            if (!component || !props.clientRect) return

            component.updateProps(props)
            popup?.[0]?.setProps({
              getReferenceClientRect: () => getReferenceClientRect(props),
            })
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === 'Escape') {
              popup?.[0]?.destroy()
              component?.destroy()
              return true
            }

            return component?.ref?.onKeyDown(props) ?? false
          },
          onExit: () => {
            popup?.[0]?.destroy()
            component?.destroy()
            popup = null
            component = null
          },
        }
      },
    },
  })
}
