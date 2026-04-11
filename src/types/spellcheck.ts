export interface SpellError {
  from: number;
  to: number;
  message: string;
  suggestions: string[];
  rule_id: string;
  is_spelling: boolean;
}
