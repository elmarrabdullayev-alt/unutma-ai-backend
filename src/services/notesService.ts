/**
 * Voice/text notes that are NOT reminders ("qeyd et: ...").
 * Kept in localStorage; storage failures never break the app.
 */
const KEY = 'unutma_ai_notes_v1';

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

function read(): Note[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.text === 'string') : [];
  } catch {
    return [];
  }
}

function write(notes: Note[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes.slice(0, 200)));
  } catch {
    // ignore: notes are best-effort
  }
}

export const notesService = {
  list(): Note[] {
    return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  add(text: string): Note {
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim().slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    write([note, ...read()]);
    return note;
  },
  remove(id: string): void {
    write(read().filter((n) => n.id !== id));
  },
};
