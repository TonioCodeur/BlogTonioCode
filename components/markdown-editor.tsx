"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  height = 500,
  placeholder,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div data-color-mode={resolvedTheme === "dark" ? "dark" : "light"}>
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={height}
        textareaProps={{ placeholder }}
        preview="live"
      />
    </div>
  );
}
