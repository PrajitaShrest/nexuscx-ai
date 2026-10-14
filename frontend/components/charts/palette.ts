// Chart colours. Categorical slots in a fixed order (checked for colour-blind
// separation with the dataviz validator). Text never uses these colours.
export const SERIES = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", yellow: "#eda100" };
// Sentiment is diverging: red (unhappy) -> gray (neutral) -> blue (happy).
export const SENTIMENT_COLOR: Record<string, string> = { angry: "#c43c3c", negative: "#ee9a8f", neutral: "#cfcdc6", positive: "#2a78d6" };
export const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", base: "#c3c2b7" };
