"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

type RichTextEditorProps = {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
};

const TOOLBAR_BASE =
  "mb-1 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--operator-border)] bg-[var(--operator-canvas)] px-1.5 py-1 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand)]/60";

const TOOLBAR_BTN =
  "rounded px-2 py-1 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-border)] disabled:opacity-40 dark:text-[var(--operator-brand)] dark:hover:bg-[var(--operator-brand-strong)]";

const EDITOR_BASE =
  "min-h-[5rem] w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm text-[var(--operator-brand)] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:text-[var(--operator-brand)] [&:empty]:before:text-[var(--operator-ink-subtle)] [&:empty]:before:content-[attr(data-placeholder)]";

export function RichTextEditor({ name, defaultValue, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  const initial = defaultValue ?? "";

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initial;
  }, [initial]);

  function sync() {
    if (hiddenRef.current && editorRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
  }

  function addLink() {
    const url = window.prompt("URL del enlace (https://…)");
    if (!url) return;
    exec("createLink", url);
  }

  function keepEditorSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  return (
    <div className="mt-1">
      <div className={TOOLBAR_BASE}>
        <button type="button" className={TOOLBAR_BTN} title="Negrita" onMouseDown={keepEditorSelection} onClick={() => exec("bold")}>
          <b>B</b>
        </button>
        <button type="button" className={TOOLBAR_BTN} title="Cursiva" onMouseDown={keepEditorSelection} onClick={() => exec("italic")}>
          <i>I</i>
        </button>
        <button type="button" className={TOOLBAR_BTN} title="Subrayado" onMouseDown={keepEditorSelection} onClick={() => exec("underline")}>
          <u>U</u>
        </button>
        <button
          type="button"
          className={TOOLBAR_BTN}
          title="Lista con viñetas"
          onMouseDown={keepEditorSelection}
          onClick={() => exec("insertUnorderedList")}
        >
          • Lista
        </button>
        <button
          type="button"
          className={TOOLBAR_BTN}
          title="Lista numerada"
          onMouseDown={keepEditorSelection}
          onClick={() => exec("insertOrderedList")}
        >
          1. Lista
        </button>
        <button type="button" className={TOOLBAR_BTN} title="Enlace" onMouseDown={keepEditorSelection} onClick={addLink}>
          🔗 Enlace
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        data-placeholder={placeholder ?? ""}
        className={`${EDITOR_BASE} ${className ?? ""}`}
      />
      <textarea ref={hiddenRef} name={name} defaultValue={initial} className="hidden" readOnly />
    </div>
  );
}
