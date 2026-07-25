export const MINERAL_ASSETS = {
  diamond: require('../../../assets/adventure/minerals/diamond.png'),
  crystal: require('../../../assets/adventure/minerals/crystal.png'),
  emerald: require('../../../assets/adventure/minerals/emerald.png'),
  ruby: require('../../../assets/adventure/minerals/ruby.png'),
  amethyst: require('../../../assets/adventure/minerals/amethyst.png'),
  topaz: require('../../../assets/adventure/minerals/topaz.png'),
  silverOre: require('../../../assets/adventure/minerals/silver_ore.png'),
  goldOre: require('../../../assets/adventure/minerals/gold_ore.png'),
} as const;

export type MineralAssetId = keyof typeof MINERAL_ASSETS;
