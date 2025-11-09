
export type Language = 'de' | 'en' | 'tr' | 'it' | 'es';

export type TranslationSet = {
  [key: string]: string;
};

export type Translations = {
  [lang in Language]: TranslationSet;
};

export type CsvData = {
  [key: string]: string;
};

export type GeneratedListing = {
  productName: string;
  title: string;
  description: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  sources?: { uri: string; title: string }[];
};