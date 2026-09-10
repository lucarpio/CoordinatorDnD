import React from "react";
import { Edit3, Trash2 } from "lucide-react";
import { DateComment } from "@/lib/supabase";
import { SupportedLocale } from "@/lib/calendarUtils";

export interface NoteItemProps {
  note: DateComment;
  isMyNote?: boolean;
  locale?: SupportedLocale;
  variant?: "card" | "compact" | "tooltip";
  formattedTime?: string;
  onEdit?: (note: DateComment) => void;
  onDelete?: (noteId: string) => void;
  editLabel?: string;
  deleteLabel?: string;
  youLabel?: string;
}

export const NoteItem: React.FC<NoteItemProps> = ({
  note,
  isMyNote = false,
  locale = "es",
  variant = "card",
  formattedTime,
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Eliminar",
  youLabel,
}) => {
  const resolvedYouLabel = youLabel || (locale === "en" ? "You" : "Tú");

  if (variant === "compact") {
    return (
      <div className="note-item-compact">
        <strong className="text-amber-300 font-bold shrink-0">{note.author}:</strong>
        <span className="italic break-words [word-break:break-word]">&ldquo;{note.text}&rdquo;</span>
      </div>
    );
  }

  if (variant === "tooltip") {
    return (
      <div className="text-[11px] bg-white/5 rounded-lg p-1.5 border border-white/10 break-words [word-break:break-word]">
        <span className="font-bold text-amber-300">{note.author}: </span>
        <span className="text-zinc-200 break-words [word-break:break-word]">&ldquo;{note.text}&rdquo;</span>
      </div>
    );
  }

  // variant === "card" (Modal)
  const stateClass = isMyNote ? "note-item-mine" : "note-item-other";

  return (
    <div
      data-testid={`note-item-${note.id}`}
      className={`note-item ${stateClass}`}
    >
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={`font-black ${isMyNote ? "text-amber-300" : "text-zinc-200"}`}>
            {note.author}
          </span>
          {isMyNote && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-bold text-[9px]">
              {resolvedYouLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {formattedTime && (
            <span className="text-zinc-500 text-[10px]">{formattedTime}</span>
          )}
          {isMyNote && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(note)}
                  title={editLabel}
                  aria-label={editLabel}
                  data-testid={`note-edit-btn-${note.id}`}
                  className="p-1 hover:text-amber-300 text-zinc-400 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  title={deleteLabel}
                  aria-label={deleteLabel}
                  data-testid={`note-delete-btn-${note.id}`}
                  className="p-1 hover:text-red-400 text-zinc-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-zinc-200 text-xs leading-relaxed break-words [word-break:break-word] font-medium">
        &ldquo;{note.text}&rdquo;
      </p>
    </div>
  );
};

export default NoteItem;
