declare interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (m: unknown) => void;
}

declare interface Translator {
  translate(text: string): Promise<string>;
}

declare var Translator: {
  availability(options: TranslatorOptions): Promise<"unavailable" | "downloadable" | "downloading" | "available" | "after-download">;
  create(options: TranslatorOptions): Promise<Translator>;
};

declare module "*.css";
