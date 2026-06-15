export interface ImportFieldDef {
  key: string;
  label: string;
  description: string;
  required: boolean;
  formatHint?: string;
  aliases: string[];
}
