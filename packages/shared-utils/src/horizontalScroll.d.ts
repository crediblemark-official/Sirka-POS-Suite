import type { Directive } from 'vue';
interface ScrollElement extends HTMLElement {
    _horizontalScrollCleanup?: () => void;
}
export declare const vHorizontalScroll: Directive<ScrollElement>;
export {};
//# sourceMappingURL=horizontalScroll.d.ts.map