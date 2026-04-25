import { useEffect, useRef, useState } from "react";
import { X, Tag as TagIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  isPending?: boolean;
  className?: string;
  placeholder?: string;
};

export function TagsInput({
  value,
  onChange,
  isPending,
  className,
  placeholder = "Add a tag...",
}: Props) {
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState<string[]>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  function commit(next: string[]) {
    setInternal(next);
    onChange(next);
  }

  function add(raw: string) {
    const t = raw.trim().slice(0, 32);
    if (!t) return;
    if (
      internal.some((existing) => existing.toLowerCase() === t.toLowerCase())
    ) {
      setDraft("");
      return;
    }
    if (internal.length >= 10) {
      setDraft("");
      return;
    }
    commit([...internal, t]);
    setDraft("");
  }

  function remove(idx: number) {
    commit(internal.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && internal.length > 0) {
      remove(internal.length - 1);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 p-2 rounded-lg border bg-background min-h-10 cursor-text",
        "focus-within:ring-2 focus-within:ring-ring focus-within:border-ring",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <TagIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
      {internal.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              remove(idx);
            }}
            className="hover:bg-primary/20 rounded p-0.5 transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => add(draft)}
        placeholder={internal.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm py-0.5"
        maxLength={32}
      />
      {isPending && (
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin mr-1" />
      )}
    </div>
  );
}
