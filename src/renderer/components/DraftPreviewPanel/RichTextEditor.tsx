/**
 * Minimal TipTap Rich Text Editor
 * Only supports: Bold, Italic, Underline
 */

import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
}

/**
 * Strip outer <p> tags from TipTap HTML output.
 * TipTap wraps everything in <p> tags, but we want inline content for list items etc.
 */
const stripOuterPTags = (html: string): string => {
  // Match content wrapped in a single <p>...</p>
  // Using [\s\S]* instead of .* with s flag for ES5 compatibility
  const match = html.match(/^<p>([\s\S]*)<\/p>$/);
  return match ? match[1] : html;
};

export const RichTextEditor = ({ content, onChange, autoFocus = true }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Underline,
    ],
    content: `<p>${content}</p>`, // Wrap incoming content in p tag for TipTap
    onUpdate: ({ editor }) => {
      // Strip outer p tags before passing to parent
      onChange(stripOuterPTags(editor.getHTML()));
    },
    autofocus: autoFocus ? 'end' : false,
  });

  // Update content if it changes externally
  useEffect(() => {
    if (editor && content !== stripOuterPTags(editor.getHTML())) {
      editor.commands.setContent(`<p>${content}</p>`);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rich-text-editor">
      {/* Minimal Toolbar */}
      <div className="rte-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'rte-btn active' : 'rte-btn'}
          title="Bold (⌘+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'rte-btn active' : 'rte-btn'}
          title="Italic (⌘+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'rte-btn active' : 'rte-btn'}
          title="Underline (⌘+U)"
        >
          <u>U</u>
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
};

export default RichTextEditor;

