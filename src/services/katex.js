import katex from "katex";
export function renderMath(math, display = false) {
    return katex.renderToString(math, { displayMode: display });
}
