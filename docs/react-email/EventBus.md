> ## Documentation Index
> Fetch the complete documentation index at: https://react.email/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Event Bus

> Communicate between editor components using typed events.

## Overview

The editor provides a typed event bus for communication between components. It's a singleton
instance built on the browser's native `CustomEvent` API with events prefixed as
`@react-email/editor:`.

```tsx theme={null}
import { editorEventBus } from '@react-email/editor/core';
```

## Dispatching events

Fire an event with a payload:

```tsx theme={null}
editorEventBus.dispatch('bubble-menu:add-link', undefined);
```

## Listening to events

Subscribe to events and clean up when done:

```tsx theme={null}
import { useEffect } from 'react';
import { editorEventBus } from '@react-email/editor/core';

function MyComponent() {
  useEffect(() => {
    const subscription = editorEventBus.on('bubble-menu:add-link', () => {
      console.log('Link addition triggered');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
```

The `on` method returns an object with an `unsubscribe` function. Always unsubscribe in a
cleanup function to avoid memory leaks.

## Built-in events

| Event                  | Payload     | Description                                                            |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| `bubble-menu:add-link` | `undefined` | Triggered when the "add link" action is initiated from the bubble menu |

## Adding custom events

Use TypeScript module augmentation to register custom events with full type safety:

```tsx theme={null}
declare module '@react-email/editor/core' {
  interface EditorEventMap {
    'my-feature:custom-event': { data: string };
    'my-feature:another-event': { count: number };
  }
}
```

Then dispatch and listen with full type checking:

```tsx theme={null}
// TypeScript knows the payload type
editorEventBus.dispatch('my-feature:custom-event', { data: 'hello' });

editorEventBus.on('my-feature:custom-event', (payload) => {
  // payload is typed as { data: string }
  console.log(payload.data);
});
```

## Event targets

By default, events are dispatched on `window`. You can scope events to a specific DOM element
using the `target` option:

```tsx theme={null}
// Dispatch on a specific element
const container = document.getElementById('my-editor');
editorEventBus.dispatch('bubble-menu:add-link', undefined, {
  target: container,
});

// Listen on a specific element
editorEventBus.on('bubble-menu:add-link', handler, {
  target: container,
});
```

This is useful when you have multiple editor instances on the same page and want events
to stay scoped to their respective editors.
