declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>("fs");

const read = (relativePath: string) =>
  fs.readFileSync(`${__dirname}/${relativePath}`, "utf8");

const gameSource = read("../../../app/game.tsx");
const homeSource = read("../../../app/index.tsx");
const backgroundSource = read("../components/GameBackground.tsx");

describe("GameBackground contract", () => {
  it("mounts only from the game route", () => {
    expect(gameSource).toContain(
      "from '@/features/game/components/GameBackground'",
    );
    expect(gameSource).toContain("<GameBackground");
    expect(homeSource).not.toContain("GameBackground");
  });

  it("derives its backdrop palette from the active world theme, not a hardcoded one", () => {
    expect(backgroundSource).toContain("LinearGradient");
    expect(backgroundSource).toContain('pointerEvents="none"');
    expect(backgroundSource).toContain("absoluteFill");
    // Palette comes from theme props (спека 12 §3), no baked-in sunset hexes.
    expect(backgroundSource).toContain("glowColors");
    expect(backgroundSource).toContain("haloColor");
    expect(backgroundSource).toContain("bgBottom");
    expect(backgroundSource).toContain("hexToRgba");
    expect(backgroundSource).not.toContain("#F6B39F");
    expect(backgroundSource).not.toContain("SOFT_SUNSET");
  });

  it("is fed the active world theme palette from the game route", () => {
    expect(gameSource).toContain("useActiveWorldTheme");
    expect(gameSource).toContain("juiceColors");
    expect(gameSource).toContain("{...bgPalette}");
  });

  it("reacts only to combo events and cleans up stale pulses", () => {
    expect(backgroundSource).toContain(
      "useGameStore((state) => state.lastEvent)",
    );
    expect(backgroundSource).toContain("combo < 2");
    expect(backgroundSource).toContain("setTimeout");
    expect(backgroundSource).toContain("clearTimeout");
    expect(backgroundSource).toContain("return clearPulseTimer");
    expect(backgroundSource).not.toContain("setInterval");
    expect(backgroundSource).not.toContain("withRepeat");
    expect(backgroundSource).not.toContain("repeat(");
  });

  it("keeps reduced motion to opacity-only fades without travel", () => {
    expect(backgroundSource).toContain("useReducedMotion");
    expect(backgroundSource).toContain("reducedMotion");
    expect(backgroundSource).toContain("opacity");
    expect(backgroundSource).toContain("scale");
    expect(backgroundSource).not.toContain("translateY");
    expect(backgroundSource).not.toContain("translateX");
  });
});
