// Deutsche Bezeichnungen für Schiffsklassen, Kategorien, Slots und Größen (nur Darstellung).
export const CLASS_LABEL = { frigate: 'Fregatte', destroyer: 'Zerstörer', cruiser: 'Kreuzer', battlecruiser: 'Schlachtkreuzer', battleship: 'Schlachtschiff', barge: 'Barke', hauler: 'Frachter' };
export const CATEGORY_LABEL = { mining: 'Bergbau', combat: 'Kampf', industrial: 'Industrie' };
export const SLOT_LABEL = { high: 'Hoch', mid: 'Mittel', low: 'Niedrig', rig: 'Rig' };
export const SIZE_LABEL = { small: 'klein', medium: 'mittel', large: 'groß' };
export const MODCAT_LABEL = { weapon: 'Waffen', mining: 'Bergbau', shield: 'Schild', armor: 'Panzerung', propulsion: 'Antrieb', engineering: 'Engineering', electronics: 'Elektronik', scanner: 'Scanner', rig: 'Rigs' };
export const GROUP_LABEL = {
  spaceship_command: 'Raumschiffkommando', gunnery: 'Geschütze', missiles: 'Raketen', industry: 'Bergbau und Industrie', engineering: 'Engineering', electronics: 'Elektronik',
  shields: 'Schilde', armor: 'Panzerung', navigation: 'Navigation', social: 'Handel und Soziales', science: 'Wissenschaft', trade: 'Handel und Soziales'
};
export const groupLabel = (g) => GROUP_LABEL[g] ?? g.replace(/_/g, ' ');
