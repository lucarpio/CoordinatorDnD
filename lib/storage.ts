export interface SavedPoll {
  slug: string;
  title: string;
  year: number;
  month: number;
  createdAt: string;
  participantsCount?: number;
  myCharacter?: string;
}

const STORAGE_KEY = "coordinator_dnd_my_polls";

export function getSavedPolls(): SavedPoll[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error("Error reading saved polls from localStorage:", err);
    return [];
  }
}

export function saveCreatedPoll(poll: SavedPoll): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getSavedPolls();
    const existingItem = existing.find((p) => p.slug === poll.slug);
    const mergedItem: SavedPoll = {
      ...existingItem,
      ...poll,
      // Conservar myCharacter previo si el nuevo objeto no lo especifica
      myCharacter: poll.myCharacter !== undefined ? poll.myCharacter : existingItem?.myCharacter,
    };
    // Evitar duplicados por slug
    const filtered = existing.filter((p) => p.slug !== poll.slug);
    const updated = [mergedItem, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("saved_polls_updated"));
  } catch (err) {
    console.error("Error saving poll to localStorage:", err);
  }
}

export function removeSavedPoll(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getSavedPolls();
    const updated = existing.filter((p) => p.slug !== slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("saved_polls_updated"));
  } catch (err) {
    console.error("Error removing poll from localStorage:", err);
  }
}
