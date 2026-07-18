import { memo, useCallback, useMemo, useState } from 'react';
import { createEditor } from 'slate';
import type { Descendant } from 'slate';
import { Slate, withReact } from 'slate-react';

import { BlockType, YjsEditorKey } from '@/application/types';
import EditorEditable from '@/components/editor/Editable';
import { defaultLayoutStyle, EditorContextProvider, EditorContextState } from '@/components/editor/EditorContext';
import { withPlugins } from '@/components/editor/plugins';
import './editor.scss';

const emptyValue: Descendant[] = [
  {
    type: BlockType.Paragraph,
    blockId: 'published-empty-paragraph',
    data: {},
    children: [
      {
        type: YjsEditorKey.text,
        textId: 'published-empty-text',
        children: [{ text: '' }],
      },
    ],
  },
] as Descendant[];

const normalizeNode = (node: any): any => {
  if (!node || typeof node !== 'object') return node;

  if ('type' in node && node.type !== undefined) {
    let children = node.children;

    if (!children || !Array.isArray(children) || children.length === 0) {
      children = [
        {
          type: YjsEditorKey.text,
          textId: (node.blockId || 'default') + '-text',
          children: [{ text: '' }],
        },
      ];
    } else {
      children = children.map(normalizeNode);
    }

    return {
      ...node,
      children,
    };
  }

  if ('text' in node) {
    return node;
  }

  return node;
};

const normalizeValue = (value: Descendant[]): Descendant[] => {
  return value.map(normalizeNode);
};

export interface StaticEditorProps extends Omit<EditorContextState, 'readOnly'> {
  value: Descendant[];
}

export const StaticEditor = memo(({ value, layoutStyle = defaultLayoutStyle, ...props }: StaticEditorProps) => {
  const [codeGrammars, setCodeGrammars] = useState<Record<string, string>>({});
  const handleAddCodeGrammars = useCallback((blockId: string, grammar: string) => {
    setCodeGrammars((prev) => ({ ...prev, [blockId]: grammar }));
  }, []);
  const editor = useMemo(() => {
    const nextEditor = withPlugins(withReact(createEditor()));

    Object.assign(nextEditor, {
      readOnly: true,
    });

    return nextEditor;
  }, []);
  const initialValue = useMemo(() => {
    const rawValue = value.length > 0 ? value : emptyValue;

    return normalizeValue(rawValue);
  }, [value]);

  return (
    <EditorContextProvider
      {...props}
      readOnly
      layoutStyle={layoutStyle}
      codeGrammars={codeGrammars}
      addCodeGrammars={handleAddCodeGrammars}
    >
      <Slate key={props.viewId} editor={editor} initialValue={initialValue}>
        <EditorEditable />
      </Slate>
    </EditorContextProvider>
  );
});

export default StaticEditor;
