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
}
