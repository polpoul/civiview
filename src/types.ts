export interface CivilizationEvent {
  id: string;
  lieu: {
    lat: number;
    lon: number;
    nom: string;
  };
  civilisation: string;
  /** Nature de l'événement : fondation, bataille, invention, expansion, effondrement, migration, découverte... */
  type?: string;
  dateDebut: string;
  /** Si absent, l'événement est considéré comme ponctuel et reste visible indéfiniment une fois apparu. */
  dateFin?: string;
  evenement: string;
  action: string;
  /** Étendue approximative de la civilisation à cette date, en km² (utilisée pour générer une forme par défaut si `territoire` est absent). */
  etendue?: number;
  /**
   * Contour précis du territoire (polygone simple, liste ordonnée de points).
   * Si fourni, remplace la forme générée automatiquement à partir de `etendue`.
   */
  territoire?: { lat: number; lon: number }[];
  /**
   * Zones exclues du territoire (enclaves, ex: un royaume non contrôlé).
   * Chaque élément est un contour fermé sur lui-même, indépendant de `territoire`.
   */
  exclusions?: { lat: number; lon: number }[][];
  /** Importance de l'événement, de 1 (mineur) à 5 (majeur). */
  importance?: number;
  categorie?: string[];
  source?: string;
}
