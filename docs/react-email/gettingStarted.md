> ## Documentation Index
> Fetch the complete documentation index at: https://react.email/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Getting Started

> Set up the email editor in your React project in under 5 minutes.

## Prerequisites

<Note>
  The editor requires **React 18+** and a bundler that supports [package exports](https://nodejs.org/api/packages.html#exports) (Vite, Next.js, Webpack 5, etc.).
</Note>

## Install

Install the editor and its peer dependencies:

<CodeGroup>
  ```sh npm theme={null}
  npm install @react-email/editor
  ```

  ```sh yarn theme={null}
  yarn add @react-email/editor
  ```

  ```sh pnpm theme={null}
  pnpm add @react-email/editor
  ```

  ```sh bun theme={null}
  bun add @react-email/editor
  ```
</CodeGroup>

## Quick start

The recommended way to start is with the standalone `EmailEditor` component. It
gives you a working editor with the default bubble menus, slash commands,
theming, and export helpers already wired up:

```tsx theme={null}
import { EmailEditor } from '@react-email/editor';

const content = `
  <h1>Welcome</h1>
  <p>
    This is the simplest way to use the editor. Try selecting text to see the
    bubble menu, or type "/" for slash commands.
  </p>
`;

export function MyEditor() {
  return <EmailEditor content={content} />;
}
```

See the [API Reference](/editor/api-reference/email-editor) for details.

<Tip>
  Start here unless you need full control over the extension list, provider
  layout, or UI composition, in which case see [Lower Level Setup](#lower-level-setup).
</Tip>

## Content format

The editor accepts content in two formats:

**HTML string** — Parsed automatically into the editor's document model:

```tsx theme={null}
const content = `
  <h1>Welcome</h1>
  <p>This is a <a href="https://react.email">link</a>.</p>
`;

<EmailEditor content={content} />
```

**TipTap JSON** — A structured document tree:

```json theme={null}
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello world" }
      ]
    }
  ]
}
```

## Lower-level setup

If you need more control, drop down to Tiptap's `EditorProvider` and compose the
editor yourself. This is the lower-level path: you choose the extensions, add
UI overlays manually, and import any CSS you need.

Common building blocks on this path are [`StarterKit`](/editor/api-reference/extensions-list),
[`BubbleMenu`](/editor/api-reference/ui/bubble-menu),
[`SlashCommand`](/editor/api-reference/ui/slash-command),
[`EmailTheming`](/editor/api-reference/theming-api),
[`composeReactEmail`](/editor/api-reference/compose-react-email), and the
[`useEditor`](/editor/api-reference/use-editor) hook.

The simplest manual setup uses `StarterKit` with `EditorProvider` and no UI
overlays:

```tsx theme={null}
import { StarterKit } from '@react-email/editor/extensions';
import { EditorProvider } from '@tiptap/react';

const extensions = [StarterKit];

const content = `
  <h1>Welcome</h1>
  <p>Start typing or edit this text.</p>
`;

export function MyEditor() {
  return <EditorProvider extensions={extensions} content={content} />;
}
```

### Import CSS

When you use the lower-level UI components directly, import the bundled theme:

```tsx theme={null}
import '@react-email/editor/themes/default.css';
```

This single import includes the default color theme and the built-in UI styles
for bubble menus, slash commands, and the inspector.

<Tip>
  If you want to import only the pieces you use, skip the bundled theme and
  import the individual CSS files instead:

  ```tsx theme={null}
  import '@react-email/editor/styles/bubble-menu.css';
  import '@react-email/editor/styles/slash-command.css';
  import '@react-email/editor/styles/inspector.css';
  ```
</Tip>

### Adding a bubble menu

To add a floating formatting toolbar that appears when you select text, add `BubbleMenu`
as a child of `EditorProvider`:

```tsx theme={null}
import { StarterKit } from '@react-email/editor/extensions';
import { BubbleMenu } from '@react-email/editor/ui';
import { EditorProvider } from '@tiptap/react';
import '@react-email/editor/themes/default.css';

const extensions = [StarterKit];

const content = `
  <p>
    Select this text to see the bubble menu. Try <strong>bold</strong>,
    <em>italic</em>, and other formatting options.
  </p>
`;

export function MyEditor() {
  return (
    <EditorProvider extensions={extensions} content={content}>
      <BubbleMenu />
    </EditorProvider>
  );
}
```

Select text in the editor to see the formatting toolbar with bold, italic,
underline, alignment, and more.

## Examples

See these features in action with runnable examples:

<CardGroup cols={2}>
  <Card title="Standalone Editor — Minimal" icon="code" href="https://react.email/editor/examples/standalone-editor">
    The simplest possible editor setup.
  </Card>

  <Card title="Basic Editor" icon="code" href="https://react.email/editor/examples/basic-editor">
    EditorProvider with StarterKit and no overlays.
  </Card>

  <Card title="Standalone Editor — Full Features" icon="code" href="https://react.email/editor/examples/standalone-editor-full">
    Theme toggle, HTML export, and JSON output.
  </Card>

  <Card title="Standalone Editor — Inspector" icon="code" href="https://react.email/editor/examples/standalone-editor-inspector">
    Add an inspector sidebar with zero manual setup.
  </Card>

  <Card title="All Examples" icon="folder-open" href="https://react.email/editor/examples">
    Browse the complete set of interactive examples.
  </Card>
</CardGroup>

## Next steps

<CardGroup cols={2}>
  <Card title="Bubble Menu" icon="message-lines" href="/editor/features/bubble-menu">
    Add floating formatting toolbars on text selection.
  </Card>

  <Card title="Slash Commands" icon="slash-forward" href="/editor/features/slash-commands">
    Insert content blocks with a command menu.
  </Card>

  <Card title="Email Theming" icon="palette" href="/editor/features/theming">
    Apply visual themes to your email output.
  </Card>

  <Card title="Email Export" icon="file-export" href="/editor/features/email-export">
    Convert editor content to email-ready HTML.
  </Card>
</CardGroup>
