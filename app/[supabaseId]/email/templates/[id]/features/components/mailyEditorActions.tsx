'use client'

import type { ReactElement, ReactNode } from 'react'
import type { BlockGroupItem, BlockItem } from '@maily-to/core/blocks'
import type { Variable } from '@maily-to/core/extensions'
import type { Editor as TiptapEditor, JSONContent, Range } from '@tiptap/core'
import {
  AlignLeft,
  Braces,
  CodeXml,
  Columns2,
  Columns3,
  Columns4,
  FileCode2,
  Film,
  ImageIcon,
  LayoutTemplate,
  List,
  ListOrdered,
  MousePointer2,
  SeparatorHorizontal,
  SquareSplitHorizontal,
  Type,
  Twitter,
  Unplug,
  Youtube,
} from 'lucide-react'
import type { LeadFlowVariableDefinition } from '../utils/emailPageStyle'

export type MailyEditorActionGroupId = 'text' | 'image' | 'grid' | 'variables'
export type MailyEditorActionMode = 'direct' | 'modal' | 'file'
export type MailyEditorModalKind = 'youtube' | 'twitter' | 'variable'

interface MailyEditorActionExecutionContext {
  editor: TiptapEditor
  range?: Range | null
}

type MailyActionIconRenderer = (className?: string) => ReactNode

export interface MailyEditorActionDefinition {
  id: string
  groupId: MailyEditorActionGroupId
  label: string
  description?: string
  searchTerms: string[]
  mode: MailyEditorActionMode
  modalKind?: MailyEditorModalKind
  renderIcon: MailyActionIconRenderer
  railVisible?: boolean
  slashVisible?: boolean
  run?: (context: MailyEditorActionExecutionContext) => void
}

export interface MailyEditorActionGroupDefinition {
  id: MailyEditorActionGroupId
  railLabel: string
  menuTitle: string
  renderIcon: MailyActionIconRenderer
}

export const MAILY_EDITOR_ACTION_GROUPS: MailyEditorActionGroupDefinition[] = [
  {
    id: 'text',
    railLabel: 'Texto',
    menuTitle: 'Text',
    renderIcon: (className) => <Type className={className ?? 'h-4 w-4'} />,
  },
  {
    id: 'image',
    railLabel: 'Imagem',
    menuTitle: 'Image',
    renderIcon: (className) => <ImageIcon className={className ?? 'h-4 w-4'} />,
  },
  {
    id: 'grid',
    railLabel: 'Grade',
    menuTitle: 'Grid',
    renderIcon: (className) => <LayoutTemplate className={className ?? 'h-4 w-4'} />,
  },
  {
    id: 'variables',
    railLabel: 'Variáveis',
    menuTitle: 'Variables',
    renderIcon: (className) => <Braces className={className ?? 'h-4 w-4'} />,
  },
]

function prepareChain(editor: TiptapEditor, range?: Range | null) {
  const chain = editor.chain().focus()

  if (range) {
    chain.deleteRange(range)
  }

  return chain
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `lf-${Math.random().toString(36).slice(2, 10)}`
}

function buildHtmlCodeBlockNode(content: string, language: string): JSONContent {
  return {
    type: 'htmlCodeBlock',
    attrs: {
      language,
      activeTab: 'preview',
      showIfKey: null,
    },
    content: content.length > 0 ? [{ type: 'text', text: content }] : [],
  }
}

function buildColumnsNode(count: 2 | 3 | 4): JSONContent {
  return {
    type: 'columns',
    attrs: {
      showIfKey: null,
      gap: 8,
    },
    content: Array.from({ length: count }, () => ({
      type: 'column',
      attrs: {
        columnId: createUuid(),
        showIfKey: null,
      },
      content: [{ type: 'paragraph' }],
    })),
  }
}

function buildUnsubscribeFooterNode(): JSONContent {
  return {
    type: 'footer',
    attrs: {
      'maily-component': 'footer',
      textDirection: 'ltr',
    },
    content: [
      {
        type: 'text',
        text: 'Want to stop receiving these emails? ',
      },
      {
        type: 'text',
        text: 'Unsubscribe',
        marks: [
          {
            type: 'link',
            attrs: {
              href: '#',
              target: '_blank',
              rel: 'noopener noreferrer',
              class: null,
            },
          },
        ],
      },
    ],
  }
}

export function normalizeVariableKey(raw: string): string {
  const stripped = raw
    .replace(/[{}]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\bfallback\s*=\s*.+$/i, ' ')
    .trim()

  return stripped
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function buildVariableToken(key: string, fallbackValue?: string | null): string {
  const normalizedKey = normalizeVariableKey(key)
  const sanitizedFallback = typeof fallbackValue === 'string' ? fallbackValue.trim() : ''

  if (!normalizedKey) {
    return ''
  }

  if (sanitizedFallback.length === 0) {
    return `{{${normalizedKey}}}`
  }

  return `{{${normalizedKey},fallback=${sanitizedFallback}}}`
}

export function buildVariableNode(variable: LeadFlowVariableDefinition, fallbackValue?: string | null): JSONContent {
  const fallback =
    typeof fallbackValue === 'string' && fallbackValue.trim().length > 0
      ? fallbackValue.trim()
      : variable.fallbackValue?.trim() || undefined

  return {
    type: 'variable',
    attrs: {
      id: variable.key,
      label: `{{${variable.key}}}`,
      fallback: fallback ?? null,
      required: false,
      hideDefaultValue: false,
    },
  }
}

function insertVariable(editor: TiptapEditor, variable: LeadFlowVariableDefinition, range?: Range | null) {
  prepareChain(editor, range)
    .insertContent([buildVariableNode(variable), { type: 'text', text: ' ' }])
    .run()
}

function buildSocialLinksHtml() {
  return `
<div style="border:1px solid #e5e7eb;border-radius:18px;padding:18px 20px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="font-size:12px;line-height:18px;color:#6b7280;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Social links</div>
  <div style="margin-top:10px;font-size:14px;line-height:24px;">
    <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:none;">Instagram</a>
    <span style="color:#cbd5e1;"> · </span>
    <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:none;">Facebook</a>
    <span style="color:#cbd5e1;"> · </span>
    <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:none;">LinkedIn</a>
    <span style="color:#cbd5e1;"> · </span>
    <a href="https://x.com/" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:none;">X</a>
  </div>
</div>`.trim()
}

const STATIC_ACTIONS: MailyEditorActionDefinition[] = [
  {
    id: 'text',
    groupId: 'text',
    label: 'Text',
    description: 'Insert a text block.',
    searchTerms: ['text', 'paragraph', 'copy'],
    mode: 'direct',
    renderIcon: (className) => <AlignLeft className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).toggleNode('paragraph', 'paragraph').run()
    },
  },
  {
    id: 'subtitle',
    groupId: 'text',
    label: 'Subtitle',
    description: 'Insert a subtitle block.',
    searchTerms: ['subtitle', 'h2', 'heading 2'],
    mode: 'direct',
    renderIcon: (className) => <Type className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    id: 'title',
    groupId: 'text',
    label: 'Title',
    description: 'Insert a title block.',
    searchTerms: ['title', 'h1', 'heading 1'],
    mode: 'direct',
    renderIcon: (className) => <Type className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    id: 'heading',
    groupId: 'text',
    label: 'Heading',
    description: 'Insert a heading block.',
    searchTerms: ['heading', 'h3', 'heading 3'],
    mode: 'direct',
    renderIcon: (className) => <Type className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    id: 'bullet-list',
    groupId: 'text',
    label: 'Bullet List',
    description: 'Create a bullet list.',
    searchTerms: ['bullet', 'list', 'unordered'],
    mode: 'direct',
    renderIcon: (className) => <List className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).toggleList('bulletList', 'listItem').run()
    },
  },
  {
    id: 'numbered-list',
    groupId: 'text',
    label: 'Numbered List',
    description: 'Create a numbered list.',
    searchTerms: ['numbered', 'ordered', 'list'],
    mode: 'direct',
    renderIcon: (className) => <ListOrdered className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).toggleList('orderedList', 'listItem').run()
    },
  },
  {
    id: 'image',
    groupId: 'image',
    label: 'Image',
    description: 'Insert an image block.',
    searchTerms: ['image', 'photo', 'media'],
    mode: 'file',
    renderIcon: (className) => <ImageIcon className={className ?? 'h-4 w-4'} />,
  },
  {
    id: 'youtube',
    groupId: 'image',
    label: 'YouTube',
    description: 'Insert a YouTube video card.',
    searchTerms: ['youtube', 'video', 'embed'],
    mode: 'modal',
    modalKind: 'youtube',
    renderIcon: (className) => <Youtube className={className ?? 'h-4 w-4'} />,
  },
  {
    id: 'twitter',
    groupId: 'image',
    label: 'X (Twitter)',
    description: 'Insert an X post card.',
    searchTerms: ['twitter', 'x', 'post', 'tweet'],
    mode: 'modal',
    modalKind: 'twitter',
    renderIcon: (className) => <Twitter className={className ?? 'h-4 w-4'} />,
  },
  {
    id: 'button',
    groupId: 'grid',
    label: 'Button',
    description: 'Insert a CTA button.',
    searchTerms: ['button', 'cta', 'action'],
    mode: 'direct',
    renderIcon: (className) => <MousePointer2 className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setButton().run()
    },
  },
  {
    id: 'divider',
    groupId: 'grid',
    label: 'Divider',
    description: 'Insert a divider.',
    searchTerms: ['divider', 'separator', 'line'],
    mode: 'direct',
    renderIcon: (className) => <SeparatorHorizontal className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setHorizontalRule().run()
    },
  },
  {
    id: 'section',
    groupId: 'grid',
    label: 'Section',
    description: 'Insert a section block.',
    searchTerms: ['section', 'container', 'layout'],
    mode: 'direct',
    renderIcon: (className) => <SquareSplitHorizontal className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setSection().run()
    },
  },
  {
    id: 'columns-2',
    groupId: 'grid',
    label: '2 Columns',
    description: 'Insert a two-column layout.',
    searchTerms: ['2 columns', 'two columns', 'columns', 'layout'],
    mode: 'direct',
    renderIcon: (className) => <Columns2 className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setColumns().run()
    },
  },
  {
    id: 'columns-3',
    groupId: 'grid',
    label: '3 Columns',
    description: 'Insert a three-column layout.',
    searchTerms: ['3 columns', 'three columns', 'columns', 'layout'],
    mode: 'direct',
    renderIcon: (className) => <Columns3 className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).insertContent(buildColumnsNode(3)).run()
    },
  },
  {
    id: 'columns-4',
    groupId: 'grid',
    label: '4 Columns',
    description: 'Insert a four-column layout.',
    searchTerms: ['4 columns', 'four columns', 'columns', 'layout'],
    mode: 'direct',
    renderIcon: (className) => <Columns4 className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).insertContent(buildColumnsNode(4)).run()
    },
  },
  {
    id: 'social-links',
    groupId: 'grid',
    label: 'Social Links',
    description: 'Insert a social links block.',
    searchTerms: ['social', 'links', 'instagram', 'facebook', 'linkedin', 'x'],
    mode: 'direct',
    renderIcon: (className) => <Film className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).insertContent(buildHtmlCodeBlockNode(buildSocialLinksHtml(), 'html')).run()
    },
  },
  {
    id: 'unsubscribe-footer',
    groupId: 'grid',
    label: 'Unsubscribe Footer',
    description: 'Insert an unsubscribe footer.',
    searchTerms: ['unsubscribe', 'footer', 'email'],
    mode: 'direct',
    renderIcon: (className) => <Unplug className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).insertContent(buildUnsubscribeFooterNode()).run()
    },
  },
  {
    id: 'html',
    groupId: 'grid',
    label: 'HTML',
    description: 'Insert a custom HTML block.',
    searchTerms: ['html', 'custom html', 'markup'],
    mode: 'direct',
    renderIcon: (className) => <CodeXml className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setHtmlCodeBlock({ language: 'html' }).run()
    },
  },
  {
    id: 'code',
    groupId: 'grid',
    label: 'Code',
    description: 'Insert a code block.',
    searchTerms: ['code', 'plaintext', 'snippet'],
    mode: 'direct',
    renderIcon: (className) => <FileCode2 className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      prepareChain(editor, range).setHtmlCodeBlock({ language: 'plaintext' }).run()
    },
  },
  {
    id: 'create-variable',
    groupId: 'variables',
    label: 'Create variable',
    description: 'Create a saved template variable.',
    searchTerms: ['create variable', 'variable', 'token'],
    mode: 'modal',
    modalKind: 'variable',
    renderIcon: (className) => <Braces className={className ?? 'h-4 w-4'} />,
  },
]

export function getMailyEditorActions(variables: LeadFlowVariableDefinition[]): MailyEditorActionDefinition[] {
  const variableActions = variables.map<MailyEditorActionDefinition>((variable) => ({
    id: `variable:${variable.key}`,
    groupId: 'variables',
    label: `{{${variable.key}}}`,
    description: variable.fallbackValue ? `Fallback: ${variable.fallbackValue}` : 'Insert this variable token.',
    searchTerms: ['variable', variable.key, variable.type],
    mode: 'direct',
    renderIcon: (className) => <Braces className={className ?? 'h-4 w-4'} />,
    run: ({ editor, range }) => {
      insertVariable(editor, variable, range)
    },
  }))

  return [...STATIC_ACTIONS.filter((action) => action.groupId !== 'variables'), ...variableActions, STATIC_ACTIONS.find((action) => action.id === 'create-variable')!]
}

export function getMailyActionGroup(id: MailyEditorActionGroupId) {
  return MAILY_EDITOR_ACTION_GROUPS.find((group) => group.id === id) ?? MAILY_EDITOR_ACTION_GROUPS[0]
}

export function getMailyRailGroups(variables: LeadFlowVariableDefinition[]) {
  const actions = getMailyEditorActions(variables)

  return MAILY_EDITOR_ACTION_GROUPS.map((group) => ({
    ...group,
    actions: actions.filter((action) => action.groupId === group.id && action.railVisible !== false),
  }))
}

export function buildMailySlashGroups({
  variables,
  onSelectAction,
}: {
  variables: LeadFlowVariableDefinition[]
  onSelectAction: (action: MailyEditorActionDefinition, context: MailyEditorActionExecutionContext) => void
}): BlockGroupItem[] {
  const actions = getMailyEditorActions(variables).filter((action) => action.slashVisible !== false)

  return MAILY_EDITOR_ACTION_GROUPS.map((group) => ({
    title: group.menuTitle,
    commands: actions
      .filter((action) => action.groupId === group.id)
      .map<BlockItem>((action) => ({
        title: action.label,
        description: action.description,
        searchTerms: action.searchTerms,
        icon: action.renderIcon('h-4 w-4 text-zinc-400') as ReactElement,
        command: ({ editor, range }) => {
          onSelectAction(action, { editor, range })
        },
      })),
  })).filter((group) => group.commands.length > 0)
}

export function buildMailyVariableSuggestions(variables: LeadFlowVariableDefinition[]): Variable[] {
  return variables.map((variable) => ({
    name: variable.key,
    label: `{{${variable.key}}}`,
    hideDefaultValue: false,
    required: false,
    valid: true,
  }))
}
