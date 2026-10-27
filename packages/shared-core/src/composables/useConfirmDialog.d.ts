export interface ConfirmDialogOptions {
    title?: string;
    message: string;
    details?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}
export declare function useConfirmDialog(): {
    isOpen: import("vue").Ref<boolean, boolean>;
    options: import("vue").Ref<{
        title?: string | undefined;
        message: string;
        details?: string | undefined;
        confirmText?: string | undefined;
        cancelText?: string | undefined;
        type?: "danger" | "warning" | "info" | undefined;
    }, ConfirmDialogOptions | {
        title?: string | undefined;
        message: string;
        details?: string | undefined;
        confirmText?: string | undefined;
        cancelText?: string | undefined;
        type?: "danger" | "warning" | "info" | undefined;
    }>;
    confirm: (opts: ConfirmDialogOptions | string) => Promise<boolean>;
    handleConfirm: () => void;
    handleCancel: () => void;
};
//# sourceMappingURL=useConfirmDialog.d.ts.map