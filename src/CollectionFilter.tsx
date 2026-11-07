import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { paints } from "./color";
import {
  collections,
  collectionIds,
  collectionForCode,
  type CollectionId,
} from "./collections";

const counts = new Map(
  collectionIds.map((id) => [
    id,
    paints.filter((p) => collectionForCode(p.id) === id).length,
  ]),
);

export function CollectionFilter({
  value,
  onChange,
  label,
}: {
  value: readonly CollectionId[];
  onChange: (value: CollectionId[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const all = collectionIds.every((id) => value.includes(id));
  const summary = all
    ? "All collections"
    : value.length === 0
      ? "No collections"
      : value.length === 1
        ? collections.find((c) => c.id === value[0])!.name
        : `${value.length} collections`;
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div
      className="collection-filter"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`collection-trigger${all ? "" : " filtered"}`}
        aria-label={label}
        title={
          all
            ? "All collections"
            : value.length
              ? collections
                  .filter((c) => value.includes(c.id))
                  .map((c) => c.name)
                  .join(", ")
              : "No collections selected"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {summary}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="collection-options" id={panelId}>
          <div className="collection-options-heading">
            <strong>Include collections</strong>
            <button
              type="button"
              className="icon-button"
              aria-label={`Close ${label.toLowerCase()}`}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="collection-actions">
            <button type="button" onClick={() => onChange([...collectionIds])}>
              Select all
            </button>
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <fieldset aria-label={label}>
            <legend className="sr-only">Include collections</legend>
            {collections.map((collection) => (
              <div className="collection-option" key={collection.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={value.includes(collection.id)}
                    onChange={(event) =>
                      onChange(
                        collectionIds.filter((id) =>
                          id === collection.id
                            ? event.target.checked
                            : value.includes(id),
                        ),
                      )
                    }
                  />
                  <span>
                    {collection.name}
                    <small>
                      {collection.codes} ·{" "}
                      {counts.get(collection.id)?.toLocaleString()} colors
                    </small>
                  </span>
                </label>
                <button
                  type="button"
                  className="collection-only"
                  aria-label={`Only ${collection.name}`}
                  onClick={() => onChange([collection.id])}
                >
                  Only
                </button>
              </div>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
