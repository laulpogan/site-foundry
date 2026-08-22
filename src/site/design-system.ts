import type { ComponentSet, DesignDNA } from "../core/types.js";

export interface CompiledDesignSystem {
  designMarkdown: string;
  tokensCss: string;
}

function radiusValue(radius: string): string {
  if (radius === "none") return "0";
  if (radius === "low") return "0.375rem";
  if (radius === "high") return "1rem";
  return "0.625rem";
}

export function compileDesignSystem(dna: DesignDNA, set: ComponentSet): CompiledDesignSystem {
  const designMarkdown = `# Design System\n\n## Direction\n\n${dna.thesis}\n\n## Layout\n\n- Grid: ${dna.layout.grid}\n- Maximum width: ${dna.layout.max_width}px\n- Section rhythm: ${dna.layout.section_rhythm}\n- Density: ${dna.density}\n\n## Typography\n\n- Display: ${dna.typography.display_character}\n- Body: ${dna.typography.body_character}\n- Scale: ${dna.typography.scale}\n\n## Color and geometry\n\n- Base: ${dna.color.base}\n- Accent count: ${dna.color.accent_count}\n- Contrast: ${dna.color.contrast}\n- Radius: ${dna.geometry.radius}\n- Borders: ${dna.geometry.borders}\n- Shadows: ${dna.geometry.shadows}\n\n## Media and motion\n\n- Media: ${dna.media.treatment}\n- Energy: ${dna.motion.energy}\n- Duration: ${dna.motion.durations}\n- Signature effects per page: ${dna.motion.signature_effects_per_page}\n\n## Component set\n\n- Foundation: ${set.foundation}\n- Accents: ${set.accents.join(", ") || "none"}\n- Icons: ${set.icon_family}\n- Motion runtime: ${set.motion_runtime}\n\n## Anti-references\n\n${dna.anti_patterns.map((pattern) => `- ${pattern}`).join("\n")}\n`;
  const tokensCss = `:root {\n  --container-max: ${dna.layout.max_width}px;\n  --space-section: clamp(4rem, 8vw, 8rem);\n  --radius-base: ${radiusValue(dna.geometry.radius)};\n  --border-color: color-mix(in srgb, currentColor 18%, transparent);\n  --shadow-subtle: 0 1px 2px rgb(0 0 0 / 0.08);\n  --motion-fast: 180ms;\n  --motion-ease: cubic-bezier(0.2, 0.8, 0.2, 1);\n  --surface: #e8ece8;\n  --surface-raised: #f7f9f7;\n  --foreground: #0e1614;\n  --muted: #596661;\n  --accent: #f05a28;\n  --grid-line: rgb(14 22 20 / 0.1);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }\n}\n`;
  return { designMarkdown, tokensCss };
}
