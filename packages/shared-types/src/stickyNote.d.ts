export type StickyNoteColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';
export interface StickyNoteItem {
    id: string;
    text: string;
    color: StickyNoteColor;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    createdAt: number;
}
export declare const colorOptions: StickyNoteColor[];
export declare const NOTE_COLORS: Record<StickyNoteColor, {
    bg: string;
    header: string;
    border: string;
    text: string;
    dot: string;
}>;
//# sourceMappingURL=stickyNote.d.ts.map