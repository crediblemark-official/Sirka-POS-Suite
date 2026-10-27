export declare const isAnyModalOpen: import("vue").ComputedRef<boolean>;
export declare function useModalLock(): {
    isAnyModalOpen: import("vue").ComputedRef<boolean>;
    acquire: () => void;
    release: () => void;
    bind: (isVisible: () => boolean) => void;
};
//# sourceMappingURL=useModalLock.d.ts.map