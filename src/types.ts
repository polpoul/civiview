export interface CivilizationEvent {
  id: string;
  lieu: {
    lat: number;
    lon: number;
    nom: string;
  };
  date: string;
  civilisation: string;
  evenement: string;
  action: string;
  /** Étendue approximative de la civilisation à cette date, en km². */
  etendue?: number;
}
