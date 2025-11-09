import React, { useState, useCallback, useRef, useEffect, MouseEvent } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Language, TranslationSet, Translations, CsvData, GeneratedListing, ChatMessage } from './types';
import * as gemini from './services/geminiService';
import { marked } from 'marked';

// --- Type Augmentation for Speech Recognition API ---
// Fix: Added a proper interface for SpeechRecognition to resolve typing errors.
interface SpeechRecognition {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: (() => void) | null;
    onresult: ((event: any) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: any) => void) | null;
    start(): void;
    stop(): void;
}

// Fix: Added a type for the SpeechRecognition constructor.
interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
}

// Fix: Moved the AIStudio interface into `declare global` to avoid module scope conflicts.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    // Fix: Made `aistudio` optional to resolve a declaration conflict with another type definition.
    aistudio?: AIStudio;
  }
}

// --- App-Specific Types ---
type InventoryItem = {
  id: number;
  name: string;
  purchasePrice: number;
  originalNotes: string;
  status: 'pending' | 'listed' | 'sold';
  salePrice?: number;
  listDate?: Date;
  sellDate?: Date;
  generatedTitle?: string;
  generatedDesc?: string;
};


// --- I18N and Constants ---
const translations: Translations = {
  de: {
    'title': 'KI Handel Kommandostand',
    'tab_purchase_listing': 'Ankauf & Inserat',
    'tab_generative_tools': 'Generative Werkzeuge',
    'tab_research': 'Recherche',
    'tab_chat': 'KI-Chat',
    'tab_field_agent': 'Saha Operatörü (Feldagent)',
    'subtab_purchase_chat': 'Ankauf Chat',
    'subtab_listing_tools': 'Inserat Werkzeuge',
    'subtab_purchase_agent': 'Einkaufs-Agent',
    'subtab_sales_agent': 'Verkaufs-Agent & Analyse',
    'purchase_chat_title': 'Ankauf Chat',
    'purchase_chat_desc': 'Kaufen Sie gebrauchte Elektronik mit KI-Unterstützung.',
    'send': 'Senden',
    'upload_image': 'Bild hochladen',
    'your_message': 'Ihre Nachricht...',
    'single_listing_title': 'Produkt-Inserat Ersteller',
    'single_listing_desc': 'Erstellen Sie schnell ein professionelles Verkaufs-Inserat.',
    'product_name': 'Produktname',
    'condition': 'Zustand',
    'notes': 'Notizen',
    'create_listing': 'Inserat erstellen',
    'copy': 'Kopieren',
    'open_ebay': 'Auf eBay öffnen',
    'open_kleinanzeigen': 'Auf Kleinanzeigen öffnen',
    'open_youtube': 'Auf YouTube öffnen',
    'bulk_listing_title': 'Massen-Inserat Ersteller',
    'bulk_listing_desc': 'Automatisieren Sie die Inserat-Erstellung aus einer CSV-Datei.',
    'download_template': 'Vorlage herunterladen',
    'upload_csv': 'CSV hochladen',
    'generate_listings': 'Inserate generieren',
    'export_json': 'JSON exportieren',
    'export_csv': 'CSV exportieren',
    'agent_config_title': 'Einkaufs-Agent Konfiguration',
    'agent_config_desc': 'Konfigurieren Sie die Parameter für Ihren automatisierten Einkaufs-Agenten.',
    'target_url': 'Ziel-URL',
    'min_profit_margin': 'Min. Gewinnspanne (€)',
    'offer_discount': 'Angebotsrabatt / Verhandlungsspielraum (€)',
    'required_keywords': 'Erforderliche Schlüsselwörter (kommagetrennt)',
    'excluded_keywords': 'Ausgeschlossene Schlüsselwörter (kommagetrennt)',
    'download_config': 'Konfiguration herunterladen',
    'image_gen_title': 'Bildgenerator',
    'image_gen_desc': 'Erstellen Sie hochwertige Bilder aus Textbeschreibungen.',
    'image_prompt_placeholder': 'z.B. ein Roboter, der ein rotes Skateboard hält',
    'generate_image': 'Bild generieren',
    'aspect_ratio': 'Seitenverhältnis',
    'video_gen_title': 'Videogenerator',
    'video_gen_desc': 'Erstellen Sie Videos aus Textbeschreibungen und optional einem Startbild.',
    'video_prompt_placeholder': 'z.B. ein Neons-Hologramm einer Katze, die mit Höchstgeschwindigkeit fährt',
    'generate_video': 'Video generieren',
    'research_title': 'Recherche mit Grounding',
    'research_desc': 'Erhalten Sie aktuelle und genaue Informationen mit Google Search und Maps.',
    'research_prompt_placeholder': 'z.B. Wer hat bei den Olympischen Spielen 2024 in Paris die meisten Bronzemedaillen gewonnen?',
    'use_maps': 'Google Maps verwenden (benötigt Standort)',
    'research': 'Recherchieren',
    'chat_title': 'Allgemeiner KI-Chat',
    'chat_desc': 'Stellen Sie Fragen und erhalten Sie Antworten von Gemini.',
    'chat_placeholder': 'Fragen Sie etwas...',
    'generating': 'Generiere...',
    'processing': 'Verarbeite...',
    'error_title': 'Fehler',
    'error_message': 'Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.',
    'edit_image_title': 'Bildbearbeitung',
    'edit_image_desc': 'Bearbeiten Sie ein Bild mit Textanweisungen.',
    'edit_image_prompt_placeholder': 'z.B. einen Retro-Filter hinzufügen',
    'sales_agent_title': 'Verkaufs-Agent & Analyse',
    'sales_agent_desc': 'Verwalten Sie Ihr Inventar, optimieren Sie Inserate und analysieren Sie Ihre Verkäufe.',
    'inventory_title': 'Zu verkaufende Produkte (Lager)',
    'product': 'Produkt',
    'purchase_price': 'Kaufpreis',
    'status': 'Status',
    'action': 'Aktion',
    'pending': 'Ausstehend',
    'listed': 'Gelistet',
    'sold': 'Verkauft',
    'generate_optimized_listing': 'Optimiertes Inserat generieren',
    'mark_as_sold': 'Als verkauft markieren',
    'enter_sale_price': 'Verkaufspreis eingeben',
    'confirm': 'Bestätigen',
    'analysis_title': 'Komplexe Analyse',
    'total_profit': 'Gesamtgewinn',
    'avg_sell_time': 'Ø Verkaufszeit',
    'inventory_value': 'Lagerwert',
    'items_sold': 'Verkaufte Artikel',
    'days': 'Tage',
    'sell_now': 'Jetzt Verkaufen',
    'select_platforms': 'Plattformen zum Inserieren auswählen',
    'generate_listing_files': 'Inserat-Dateien generieren',
    'cancel': 'Abbrechen',
    'sell_selected_items': 'Ausgewählte verkaufen',
    'agent_status': 'Agentenstatus',
    'idle': 'Leerlauf',
    'running': 'Läuft...',
    'stopped': 'Gestoppt',
    'start_agent': 'Agent starten',
    'stop_agent': 'Agent stoppen',
    'live_log': 'Live-Protokoll',
    'field_agent_config_title': 'Feldagent Konfiguration',
    'field_agent_config_desc': 'Konfigurieren Sie den Agenten für den Einsatz vor Ort.',
    'target_platform': 'Zielplattform',
    'search_query': 'Suchanfrage',
    'max_budget': 'Maximales Budget (€)',
    'message_template': 'Nachrichtenvorlage',
    'agent_awaiting_start': 'Agent wartet auf Befehle. Klicken Sie auf "Agent starten", um zu beginnen.',
    'agent_paused': 'Pausiert',
    'user_decision_needed': 'Benutzerentscheidung erforderlich',
    'item_found': 'Angebot gefunden',
    'price': 'Preis',
    'send_message': 'Nachricht senden',
    'skip': 'Überspringen',
    'agent_activity': 'Agentenaktivität',
  },
  en: { 
    'title': 'AI Trade Command Center',
    'tab_purchase_listing': 'Purchase & Listing',
    'tab_generative_tools': 'Generative Tools',
    'tab_research': 'Research',
    'tab_chat': 'AI Chat',
    'tab_field_agent': 'Field Agent',
    'subtab_purchase_chat': 'Purchase Chat',
    'subtab_listing_tools': 'Listing Tools',
    'subtab_purchase_agent': 'Purchase Agent',
    'subtab_sales_agent': 'Sales Agent & Analysis',
    'purchase_chat_title': 'Purchase Chat',
    'purchase_chat_desc': 'Buy used electronics with AI assistance.',
    'send': 'Send',
    'upload_image': 'Upload Image',
    'your_message': 'Your message...',
    'single_listing_title': 'Product Listing Generator',
    'single_listing_desc': 'Quickly create a professional sales listing.',
    'product_name': 'Product Name',
    'condition': 'Condition',
    'notes': 'Notes',
    'create_listing': 'Create Listing',
    'copy': 'Copy',
    'open_ebay': 'Open on eBay',
    'open_kleinanzeigen': 'Open on Kleinanzeigen',
    'open_youtube': 'Open on YouTube',
    'bulk_listing_title': 'Bulk Listing Generator',
    'bulk_listing_desc': 'Automate listing creation from a CSV file.',
    'download_template': 'Download Template',
    'upload_csv': 'Upload CSV',
    'generate_listings': 'Generate Listings',
    'export_json': 'Export JSON',
    'export_csv': 'Export CSV',
    'agent_config_title': 'Purchase Agent Configuration',
    'agent_config_desc': 'Configure the parameters for your automated purchase agent.',
    'target_url': 'Target URL',
    'min_profit_margin': 'Min. Profit Margin (€)',
    'offer_discount': 'Offer Discount / Bargaining Margin (€)',
    'required_keywords': 'Required Keywords (comma-separated)',
    'excluded_keywords': 'Excluded Keywords (comma-separated)',
    'download_config': 'Download Config',
    'image_gen_title': 'Image Generator',
    'image_gen_desc': 'Create high-quality images from text descriptions.',
    'image_prompt_placeholder': 'e.g., a robot holding a red skateboard',
    'generate_image': 'Generate Image',
    'aspect_ratio': 'Aspect Ratio',
    'video_gen_title': 'Video Generator',
    'video_gen_desc': 'Create videos from text descriptions and an optional starting image.',
    'video_prompt_placeholder': 'e.g., a neon hologram of a cat driving at top speed',
    'generate_video': 'Generate Video',
    'research_title': 'Research with Grounding',
    'research_desc': 'Get up-to-date and accurate information using Google Search and Maps.',
    'research_prompt_placeholder': 'e.g., Who won the most individual bronze medals at the 2024 Paris Olympics?',
    'use_maps': 'Use Google Maps (requires location)',
    'research': 'Research',
    'chat_title': 'General AI Chat',
    'chat_desc': 'Ask questions and get answers from Gemini.',
    'chat_placeholder': 'Ask anything...',
    'generating': 'Generating...',
    'processing': 'Processing...',
    'error_title': 'Error',
    'error_message': 'Something went wrong. Please try again.',
    'edit_image_title': 'Image Editor',
    'edit_image_desc': 'Edit an image using text prompts.',
    'edit_image_prompt_placeholder': 'e.g., add a retro filter',
    'sales_agent_title': 'Sales Agent & Analysis',
    'sales_agent_desc': 'Manage your inventory, optimize listings, and analyze your sales.',
    'inventory_title': 'Products to Sell (Inventory)',
    'product': 'Product',
    'purchase_price': 'Purchase Price',
    'status': 'Status',
    'action': 'Action',
    'pending': 'Pending',
    'listed': 'Listed',
    'sold': 'Sold',
    'generate_optimized_listing': 'Generate Optimized Listing',
    'mark_as_sold': 'Mark as Sold',
    'enter_sale_price': 'Enter Sale Price',
    'confirm': 'Confirm',
    'analysis_title': 'Complex Analysis',
    'total_profit': 'Total Profit',
    'avg_sell_time': 'Avg. Sell Time',
    'inventory_value': 'Inventory Value',
    'items_sold': 'Items Sold',
    'days': 'days',
    'sell_now': 'Sell Now',
    'select_platforms': 'Select platforms to list on',
    'generate_listing_files': 'Generate Listing Files',
    'cancel': 'Cancel',
    'sell_selected_items': 'Sell Selected',
    'agent_status': 'Agent Status',
    'idle': 'Idle',
    'running': 'Running...',
    'stopped': 'Stopped',
    'start_agent': 'Start Agent',
    'stop_agent': 'Stop Agent',
    'live_log': 'Live Log',
    'field_agent_config_title': 'Field Agent Configuration',
    'field_agent_config_desc': 'Configure the parameters for your automated field agent.',
    'target_platform': 'Target Platform',
    'search_query': 'Search Query',
    'max_budget': 'Max Budget (€)',
    'message_template': 'Message Template',
    'agent_awaiting_start': 'Agent is awaiting commands. Click "Start Agent" to begin.',
    'agent_paused': 'Paused',
    'user_decision_needed': 'User Decision Needed',
    'item_found': 'Listing Found',
    'price': 'Price',
    'send_message': 'Send Message',
    'skip': 'Skip',
    'agent_activity': 'Agent Activity',
  },
  tr: {
    'title': 'Yapay Zeka Ticaret Komuta Merkezi',
    'tab_purchase_listing': 'Satın Alma & İlan',
    'tab_generative_tools': 'Üretken Araçlar',
    'tab_research': 'Araştırma',
    'tab_chat': 'Yapay Zeka Sohbeti',
    'tab_field_agent': 'Saha Operatörü',
    'subtab_purchase_chat': 'Satın Alma Sohbeti',
    'subtab_listing_tools': 'İlan Araçları',
    'subtab_purchase_agent': 'Satın Alma Ajanı',
    'subtab_sales_agent': 'Satış Ajanı ve Analiz',
    'purchase_chat_title': 'Satın Alma Sohbeti',
    'purchase_chat_desc': 'Yapay zeka yardımıyla ikinci el elektronik ürünler satın alın.',
    'send': 'Gönder',
    'upload_image': 'Resim Yükle',
    'your_message': 'Mesajınız...',
    'single_listing_title': 'Ürün İlanı Oluşturucu',
    'single_listing_desc': 'Hızlıca profesyonel bir satış ilanı oluşturun.',
    'product_name': 'Ürün Adı',
    'condition': 'Durum',
    'notes': 'Notlar',
    'create_listing': 'İlan Oluştur',
    'copy': 'Kopyala',
    'open_ebay': 'eBay\'de Aç',
    'open_kleinanzeigen': 'Kleinanzeigen\'de Aç',
    'open_youtube': 'YouTube\'da Aç',
    'bulk_listing_title': 'Toplu İlan Oluşturucu',
    'bulk_listing_desc': 'Bir CSV dosyasından ilan oluşturmayı otomatikleştirin.',
    'download_template': 'Şablonu İndir',
    'upload_csv': 'CSV Yükle',
    'generate_listings': 'İlanları Oluştur',
    'export_json': 'JSON Olarak Dışa Aktar',
    'export_csv': 'CSV Olarak Dışa Aktar',
    'agent_config_title': 'Satın Alma Ajanı Yapılandırması',
    'agent_config_desc': 'Otomatik satın alma ajanınız için parametreleri yapılandırın.',
    'target_url': 'Hedef URL',
    'min_profit_margin': 'Min. Kâr Marjı (€)',
    'offer_discount': 'Teklif İndirimi / Pazarlık Payı (€)',
    'required_keywords': 'Gerekli Anahtar Kelimeler (virgülle ayrılmış)',
    'excluded_keywords': 'Hariç Tutulan Anahtar Kelimeler (virgülle ayrılmış)',
    'download_config': 'Yapılandırmayı İndir',
    'image_gen_title': 'Görüntü Oluşturucu',
    'image_gen_desc': 'Metin açıklamalarından yüksek kaliteli görüntüler oluşturun.',
    'image_prompt_placeholder': 'örneğin, kırmızı bir kaykay tutan bir robot',
    'generate_image': 'Görüntü Oluştur',
    'aspect_ratio': 'En Boy Oranı',
    'video_gen_title': 'Video Oluşturucu',
    'video_gen_desc': 'Metin açıklamalarından ve isteğe bağlı bir başlangıç görüntüsünden videolar oluşturun.',
    'video_prompt_placeholder': 'örneğin, son hızda giden bir kedinin neon hologramı',
    'generate_video': 'Video Oluştur',
    'research_title': 'Grounding ile Araştırma',
    'research_desc': 'Google Arama ve Haritalar\'ı kullanarak güncel ve doğru bilgiler edinin.',
    'research_prompt_placeholder': 'örneğin, 2024 Paris Olimpiyatları\'nda en çok bireysel bronz madalyayı kim kazandı?',
    'use_maps': 'Google Haritalar\'ı kullan (konum gerektirir)',
    'research': 'Araştır',
    'chat_title': 'Genel Yapay Zeka Sohbeti',
    'chat_desc': 'Sorular sorun ve Gemini\'den yanıtlar alın.',
    'chat_placeholder': 'Herhangi bir şey sorun...',
    'generating': 'Oluşturuluyor...',
    'processing': 'İşleniyor...',
    'error_title': 'Hata',
    'error_message': 'Bir şeyler ters gitti. Lütfen tekrar deneyin.',
    'edit_image_title': 'Görüntü Düzenleyici',
    'edit_image_desc': 'Metin komutlarını kullanarak bir görüntüyü düzenleyin.',
    'edit_image_prompt_placeholder': 'örneğin, bir retro filtre ekle',
    'sales_agent_title': 'Satış Ajanı ve Analiz',
    'sales_agent_desc': 'Envanterinizi yönetin, ilanları optimize edin ve satışlarınızı analiz edin.',
    'inventory_title': 'Satılacak Ürünler (Stok)',
    'product': 'Ürün',
    'purchase_price': 'Alış Fiyatı',
    'status': 'Durum',
    'action': 'Eylem',
    'pending': 'Beklemede',
    'listed': 'Listelenmiş',
    'sold': 'Satıldı',
    'generate_optimized_listing': 'Optimize Edilmiş İlan Oluştur',
    'mark_as_sold': 'Satıldı Olarak İşaretle',
    'enter_sale_price': 'Satış Fiyatını Girin',
    'confirm': 'Onayla',
    'analysis_title': 'Karmaşık Analiz',
    'total_profit': 'Toplam Kâr',
    'avg_sell_time': 'Ort. Satış Süresi',
    'inventory_value': 'Stok Değeri',
    'items_sold': 'Satılan Ürünler',
    'days': 'gün',
    'sell_now': 'Şimdi Sat',
    'select_platforms': 'Listelemek için platformları seçin',
    'generate_listing_files': 'İlan Dosyalarını Oluştur',
    'cancel': 'İptal',
    'sell_selected_items': 'Seçilenleri Sat',
    'agent_status': 'Operatör Durumu',
    'idle': 'Beklemede',
    'running': 'Çalışıyor...',
    'stopped': 'Durduruldu',
    'start_agent': 'Operatörü Başlat',
    'stop_agent': 'Operatörü Durdur',
    'live_log': 'Canlı Kayıt',
    'field_agent_config_title': 'Saha Operatörü Yapılandırması',
    'field_agent_config_desc': 'Otomatik saha operatörünüz için parametreleri yapılandırın.',
    'target_platform': 'Hedef Platform',
    'search_query': 'Arama Sorgusu',
    'max_budget': 'Maksimum Bütçe (€)',
    'message_template': 'Mesaj Şablonu',
    'agent_awaiting_start': 'Operatör başlatılmayı bekliyor. Başlamak için "Operatörü Başlat"a tıklayın.',
    'agent_paused': 'Duraklatıldı',
    'user_decision_needed': 'Kullanıcı Kararı Gerekiyor',
    'item_found': 'İlan Bulundu',
    'price': 'Fiyat',
    'send_message': 'Mesaj Gönder',
    'skip': 'Geç',
    'agent_activity': 'Operatör Aktivitesi',
  },
  it: {} as TranslationSet,
  es: {} as TranslationSet,
};

// --- Language Context ---
export const LanguageContext = React.createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}>({
  language: 'tr',
  setLanguage: () => {},
  t: () => '',
});

export const useLanguage = () => React.useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('tr');

  const t = useCallback((key: string) => {
    return translations[language][key] || translations['en'][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};


// --- Helper Functions & Components ---

const downloadFile = (content: string, fileName: string, contentType: string) => {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
};

const parseCSV = (csvText: string): CsvData[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index];
      return obj;
    }, {} as CsvData);
  });
};

const toCSV = (data: GeneratedListing[]): string => {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  const rows = data.map(item =>
    headers.map(header => `"${(item as any)[header].toString().replace(/"/g, '""')}"`).join(',')
  );
  return [headerRow, ...rows].join('\n');
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface p-6 rounded-lg border border-border shadow-lg ${className}`}>
    {children}
  </div>
);

const Button: React.FC<{ children: React.ReactNode; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; className?: string, disabled?: boolean, type?: 'button' | 'submit' | 'reset' }> = ({ children, onClick, className = '', disabled=false, type='button' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type={type}
    className={`bg-primary text-white font-bold py-2 px-4 rounded-lg transition-colors ${
      disabled ? 'bg-gray-500 cursor-not-allowed' : 'hover:bg-primary-hover'
    } ${className}`}
  >
    {children}
  </button>
);

const Input: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; type?: string, onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; name?: string }> = ({ value, onChange, placeholder, type = 'text', onKeyDown, name }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    onKeyDown={onKeyDown}
    name={name}
    className="w-full bg-background border border-border rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
  />
);

const TextArea: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string; rows?: number; name?: string; }> = ({ value, onChange, placeholder, rows=4, name }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    name={name}
    className="w-full bg-background border border-border rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
  />
);

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center space-x-2">
        <div className="w-4 h-4 rounded-full animate-pulse bg-primary"></div>
        <div className="w-4 h-4 rounded-full animate-pulse bg-primary delay-200"></div>
        <div className="w-4 h-4 rounded-full animate-pulse bg-primary delay-400"></div>
    </div>
);


export const Header: React.FC<{ onTitleClick: () => void, titleKey?: string }> = ({ onTitleClick, titleKey = 'title' }) => {
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const flags: { [key in Language]: string } = {
    de: '🇩🇪', en: '🇬🇧', tr: '🇹🇷', it: '🇮🇹', es: '🇪🇸'
  };

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  return (
    <header className="bg-surface p-4 flex justify-between items-center border-b border-border shadow-md sticky top-0 z-50">
      <div className="flex-1 min-w-0">
        <button onClick={onTitleClick} className="text-left focus:outline-none focus:ring-2 focus:ring-primary rounded">
          <h1 className="text-xl md:text-2xl font-bold text-text-primary truncate whitespace-nowrap hover:text-primary transition-colors duration-200">{t(titleKey)}</h1>
        </button>
      </div>
      <div className="relative ml-4" ref={menuRef}>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-2xl p-2 rounded-full hover:bg-background transition-colors">
          {flags[language]}
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-surface border border-border rounded-lg shadow-xl py-1 z-10">
            {(Object.keys(flags) as Language[]).map(lang => (
              <button
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-text-secondary hover:bg-background hover:text-text-primary transition-colors flex items-center"
              >
                <span className="text-xl mr-3">{flags[lang]}</span>
                <span>{lang.toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};


// --- MODULES ---

const AnkaufChat: React.FC = () => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup speech recognition on component unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, image: imagePreview || undefined };
    setMessages(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    setInput('');
    setImage(null);
    setImagePreview(null);
    
    try {
      const response = await gemini.getAnkaufOffer(input, image || undefined);
      const modelMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: response };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: `${t('error_title')}: ${t('error_message')}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
    }
  };

  const handleMicClick = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [isListening, language]);


  return (
    <Card>
      <h3 className="text-xl font-bold text-text-primary mb-1">{t('purchase_chat_title')}</h3>
      <p className="text-text-secondary mb-4">{t('purchase_chat_desc')}</p>
      <div className="h-96 bg-background rounded-lg p-4 overflow-y-auto flex flex-col space-y-4 border border-border">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-700 text-text-primary'}`}>
              {msg.image && <img src={msg.image} alt="User upload" className="rounded-lg mb-2 max-h-48" />}
               <div dangerouslySetInnerHTML={{ __html: marked(msg.text) }} className="prose prose-invert prose-sm"></div>
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-700"><Spinner /></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-4 flex items-center space-x-2">
        <input type="file" accept="image/*" id="image-upload" className="hidden" onChange={handleImageChange} />
        <label htmlFor="image-upload" className="cursor-pointer p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
        </label>
        <button onClick={handleMicClick} className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`} aria-label="Start voice input">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t('your_message')} />
        <Button onClick={handleSubmit} disabled={isLoading || !input.trim()}>{t('send')}</Button>
      </div>
      {imagePreview && <div className="mt-2 text-sm text-text-secondary">{t('upload_image')}: {image?.name}</div>}
    </Card>
  );
};

const InseratTools: React.FC = () => {
    const { t } = useLanguage();
    const [activeSubTab, setActiveSubTab] = useState<'single' | 'bulk'>('single');

    // State for Single Listing
    const [productName, setProductName] = useState('');
    const [condition, setCondition] = useState('');
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isLoadingSingle, setIsLoadingSingle] = useState(false);
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [generatedDesc, setGeneratedDesc] = useState('');

    // State for Bulk Listing
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isLoadingBulk, setIsLoadingBulk] = useState(false);
    const [bulkResults, setBulkResults] = useState<GeneratedListing[]>([]);

    const handleSingleSubmit = async () => {
        setIsLoadingSingle(true);
        setGeneratedTitle('');
        setGeneratedDesc('');
        try {
            const { title, description } = await gemini.generateSingleListing(productName, condition, notes, image || undefined);
            setGeneratedTitle(title);
            setGeneratedDesc(description);
        } catch (error) {
            console.error(error);
            setGeneratedTitle(t('error_title'));
            setGeneratedDesc(t('error_message'));
        } finally {
            setIsLoadingSingle(false);
        }
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleOpenEbay = () => {
        const url = `https://www.ebay.de/sl/prelist/suggest?title=${encodeURIComponent(generatedTitle)}&description=${encodeURIComponent(generatedDesc)}`;
        window.open(url, '_blank');
    };

    const handleDownloadTemplate = () => {
        const template = "productName,condition,price,notes\nLaptop X,Used,500,Slight scratch on corner\nPhone Y,Good,300,Comes with original box";
        downloadFile(template, 'template.csv', 'text/csv');
    };
    
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCsvFile(e.target.files[0]);
        }
    };

    const handleBulkSubmit = async () => {
        if (!csvFile) return;
        setIsLoadingBulk(true);
        setBulkResults([]);
        try {
            const text = await csvFile.text();
            const data = parseCSV(text);
            const results = await gemini.generateBulkListings(data);
            setBulkResults(results as GeneratedListing[]);
        } catch(error) {
            console.error(error);
        } finally {
            setIsLoadingBulk(false);
        }
    };

    return (
        <Card>
            <div className="flex border-b border-border mb-4">
                <button onClick={() => setActiveSubTab('single')} className={`py-2 px-4 text-sm font-medium ${activeSubTab === 'single' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}>{t('single_listing_title')}</button>
                <button onClick={() => setActiveSubTab('bulk')} className={`py-2 px-4 text-sm font-medium ${activeSubTab === 'bulk' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}>{t('bulk_listing_title')}</button>
            </div>

            {activeSubTab === 'single' && (
                <div>
                    <h3 className="text-xl font-bold text-text-primary mb-1">{t('single_listing_title')}</h3>
                    <p className="text-text-secondary mb-4">{t('single_listing_desc')}</p>
                    <div className="space-y-4">
                        <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder={t('product_name')} />
                        <Input value={condition} onChange={e => setCondition(e.target.value)} placeholder={t('condition')} />
                        <TextArea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('notes')} />
                        <div>
                            <label className="text-text-secondary text-sm">{t('upload_image')} (optional)</label>
                            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover"/>
                        </div>
                        <Button onClick={handleSingleSubmit} disabled={isLoadingSingle}>{isLoadingSingle ? t('generating') : t('create_listing')}</Button>
                    </div>
                    {(generatedTitle || generatedDesc) && (
                        <div className="mt-6 p-4 bg-background rounded-lg border border-border">
                            <h4 className="font-bold text-lg text-text-primary">{generatedTitle}</h4>
                            <div className="prose prose-invert mt-2 text-text-secondary max-w-none" dangerouslySetInnerHTML={{ __html: marked(generatedDesc) }} />
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button onClick={() => handleCopyToClipboard(generatedTitle)} className="text-sm">{t('copy')} Title</Button>
                                <Button onClick={() => handleCopyToClipboard(generatedDesc)} className="text-sm">{t('copy')} Desc</Button>
                                <Button onClick={handleOpenEbay} className="text-sm">{t('open_ebay')}</Button>
                                <Button onClick={() => window.open('https://www.kleinanzeigen.de/s-anzeige-aufgeben.html', '_blank')} className="text-sm">{t('open_kleinanzeigen')}</Button>
                                <Button onClick={() => window.open('https://studio.youtube.com', '_blank')} className="text-sm">{t('open_youtube')}</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeSubTab === 'bulk' && (
                 <div>
                    <h3 className="text-xl font-bold text-text-primary mb-1">{t('bulk_listing_title')}</h3>
                    <p className="text-text-secondary mb-4">{t('bulk_listing_desc')}</p>
                    <div className="space-y-4">
                        <Button onClick={handleDownloadTemplate}>{t('download_template')}</Button>
                        <div>
                            <label className="text-text-secondary text-sm">{t('upload_csv')}</label>
                            <input type="file" accept=".csv" onChange={handleCsvUpload} className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover"/>
                        </div>
                        <Button onClick={handleBulkSubmit} disabled={isLoadingBulk || !csvFile}>{isLoadingBulk ? t('processing') : t('generate_listings')}</Button>
                    </div>
                    {bulkResults.length > 0 && (
                        <div className="mt-6">
                            <h4 className="font-bold text-lg text-text-primary mb-2">Generated Listings ({bulkResults.length})</h4>
                            <div className="h-96 overflow-y-auto bg-background p-2 rounded-lg border border-border">
                                <table className="w-full text-sm text-left text-text-secondary">
                                    <thead className="text-xs text-text-primary uppercase bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Product Name</th>
                                            <th scope="col" className="px-6 py-3">Generated Title</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkResults.map((item, index) => (
                                            <tr key={index} className="bg-surface border-b border-border hover:bg-background">
                                                <td className="px-6 py-4">{item.productName}</td>
                                                <td className="px-6 py-4">{item.title}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Button onClick={() => downloadFile(JSON.stringify(bulkResults, null, 2), 'listings.json', 'application/json')}>{t('export_json')}</Button>
                                <Button onClick={() => downloadFile(toCSV(bulkResults), 'listings.csv', 'text/csv')}>{t('export_csv')}</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};


export const AgentConfig: React.FC = () => {
    const { t } = useLanguage();
    const [config, setConfig] = useState({
        targetUrl: 'https://www.ebay.de',
        minProfitMargin: '50',
        offerDiscount: '100',
        requiredKeywords: 'Hp Probbok 470 G5 17 Zoll, Defekt, Kaput, Kratze, Beschädigt, Totalschade',
        excludedKeywords: 'Soringt nicht an, Ohnne Festplatte, Ohnne SSD, Ohne Ram, ohne Arbeitsspeicher',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleDownload = () => {
        const fileContent = JSON.stringify({
            target_url: config.targetUrl,
            min_profit_margin: parseFloat(config.minProfitMargin) || 0,
            offer_discount: parseFloat(config.offerDiscount) || 0,
            required_keywords: config.requiredKeywords.split(',').map(k => k.trim()).filter(Boolean),
            excluded_keywords: config.excludedKeywords.split(',').map(k => k.trim()).filter(Boolean),
        }, null, 2);
        downloadFile(fileContent, 'agent_config.json', 'application/json');
    };

    return (
        <Card>
            <h3 className="text-xl font-bold text-text-primary mb-1">{t('agent_config_title')}</h3>
            <p className="text-text-secondary mb-4">{t('agent_config_desc')}</p>
            <div className="space-y-4">
                <Input name="targetUrl" value={config.targetUrl} onChange={handleChange} placeholder={t('target_url')} />
                <Input name="minProfitMargin" type="number" value={config.minProfitMargin} onChange={handleChange} placeholder={t('min_profit_margin')} />
                <Input name="offerDiscount" type="number" value={config.offerDiscount} onChange={handleChange} placeholder={t('offer_discount')} />
                <Input name="requiredKeywords" value={config.requiredKeywords} onChange={handleChange} placeholder={t('required_keywords')} />
                <Input name="excludedKeywords" value={config.excludedKeywords} onChange={handleChange} placeholder={t('excluded_keywords')} />
                <Button onClick={handleDownload}>{t('download_config')}</Button>
            </div>
        </Card>
    );
};

export const SalesAgent: React.FC = () => {
  const { t } = useLanguage();
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { id: 1, name: 'HP Probook 470 G5 17 Zoll', purchasePrice: 60, originalNotes: 'Kratzer am Gehäuse, sonst ok. Akku schwach.', status: 'pending' },
    { id: 2, name: 'MacBook Pro 2019', purchasePrice: 450, originalNotes: 'Top Zustand, mit OVP. Kaum genutzt.', status: 'pending' },
    { id: 3, name: 'Defektes Surface Pro 7', purchasePrice: 20, originalNotes: 'Display gesprungen, startet nicht mehr. Für Bastler.', status: 'sold', salePrice: 55, listDate: new Date('2025-11-01'), sellDate: new Date('2025-11-04') },
  ]);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [platforms, setPlatforms] = useState({ ebay: true, kleinanzeigen: false, youtube: false });


  const handleGenerateListing = async (item: InventoryItem) => {
    setLoadingItemId(item.id);
    try {
      const { title, description } = await gemini.generateSingleListing(item.name, 'Gebraucht', item.originalNotes);
      setInventory(prev => prev.map(invItem => 
        invItem.id === item.id 
        ? { ...invItem, generatedTitle: title, generatedDesc: description, status: 'listed', listDate: new Date() } 
        : invItem
      ));
    } catch(e) {
      console.error(e);
      alert(t('error_message'));
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleMarkAsSold = (item: InventoryItem) => {
    const salePrice = prompt(t('enter_sale_price'));
    if (salePrice && !isNaN(parseFloat(salePrice))) {
      setInventory(prev => prev.map(invItem => 
        invItem.id === item.id 
        ? { ...invItem, status: 'sold', salePrice: parseFloat(salePrice), sellDate: new Date() } 
        : invItem
      ));
    }
  };

  const handlePlatformChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPlatforms(prev => ({ ...prev, [name]: checked }));
  };

  const handleGenerateFiles = () => {
    if (selectedItemIds.size === 0) return;

    const itemsToProcess = inventory.filter(item => selectedItemIds.has(item.id));

    itemsToProcess.forEach(currentItem => {
      if (!currentItem.generatedTitle) {
        alert(`Bitte generieren Sie zuerst ein optimiertes Inserat für "${currentItem.name}".`);
        return;
      }
      Object.entries(platforms).forEach(([platform, isSelected]) => {
        if (isSelected) {
          const task = {
            platform,
            product: {
              title: currentItem.generatedTitle,
              description: currentItem.generatedDesc,
              price: (currentItem.purchasePrice * 2) + 50, // Example pricing logic
            }
          };
          downloadFile(JSON.stringify(task, null, 2), `${platform}_task_${currentItem.id}.json`, 'application/json');
        }
      });
    });

    setIsSellModalOpen(false);
    setSelectedItemIds(new Set()); // Clear selection after processing
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allListedIds = inventory.filter(i => i.status === 'listed').map(i => i.id);
      setSelectedItemIds(new Set(allListedIds));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleSelectItem = (itemId: number, isSelected: boolean) => {
    const newSet = new Set(selectedItemIds);
    if (isSelected) {
      newSet.add(itemId);
    } else {
      newSet.delete(itemId);
    }
    setSelectedItemIds(newSet);
  };

  // Analysis Calculations
  const soldItems = inventory.filter(item => item.status === 'sold');
  const totalProfit = soldItems.reduce((acc, item) => acc + (item.salePrice! - item.purchasePrice), 0);
  const totalInventoryValue = inventory.filter(item => item.status !== 'sold').reduce((acc, item) => acc + item.purchasePrice, 0);
  const avgSellTime = soldItems.length > 0 ? soldItems.reduce((acc, item) => {
    const timeDiff = item.sellDate!.getTime() - item.listDate!.getTime();
    return acc + (timeDiff / (1000 * 3600 * 24));
  }, 0) / soldItems.length : 0;
  
  const listedItemsCount = inventory.filter(i => i.status === 'listed').length;
  const allListedItemsSelected = listedItemsCount > 0 && selectedItemIds.size === listedItemsCount;

  return (
    <Card>
      <h3 className="text-xl font-bold text-text-primary mb-1">{t('sales_agent_title')}</h3>
      <p className="text-text-secondary mb-6">{t('sales_agent_desc')}</p>

      {/* Analysis Dashboard */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-text-primary mb-3">{t('analysis_title')}</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background p-4 rounded-lg text-center">
            <p className="text-sm text-text-secondary">{t('total_profit')}</p>
            <p className="text-2xl font-bold text-green-400">{totalProfit.toFixed(2)}€</p>
          </div>
          <div className="bg-background p-4 rounded-lg text-center">
            <p className="text-sm text-text-secondary">{t('avg_sell_time')}</p>
            <p className="text-2xl font-bold text-text-primary">{avgSellTime.toFixed(1)} <span className="text-base">{t('days')}</span></p>
          </div>
          <div className="bg-background p-4 rounded-lg text-center">
            <p className="text-sm text-text-secondary">{t('inventory_value')}</p>
            <p className="text-2xl font-bold text-text-primary">{totalInventoryValue.toFixed(2)}€</p>
          </div>
          <div className="bg-background p-4 rounded-lg text-center">
            <p className="text-sm text-text-secondary">{t('items_sold')}</p>
            <p className="text-2xl font-bold text-text-primary">{soldItems.length}</p>
          </div>
        </div>
      </div>


      {/* Inventory Table */}
      <div>
        <h4 className="text-lg font-semibold text-text-primary mb-3">{t('inventory_title')}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-text-secondary">
            <thead className="text-xs text-text-primary uppercase bg-gray-700">
              <tr>
                <th scope="col" className="px-2 py-3">
                  <input type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={allListedItemsSelected}
                    onChange={handleSelectAll}
                    disabled={listedItemsCount === 0}
                  />
                </th>
                <th scope="col" className="px-6 py-3">{t('product')}</th>
                <th scope="col" className="px-6 py-3">{t('purchase_price')}</th>
                <th scope="col" className="px-6 py-3">{t('status')}</th>
                <th scope="col" className="px-6 py-3">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => (
                <React.Fragment key={item.id}>
                  <tr className="bg-surface border-b border-border hover:bg-background">
                    <td className="px-2 py-4">
                      {item.status === 'listed' && (
                        <input type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedItemIds.has(item.id)}
                          onChange={e => handleSelectItem(item.id, e.target.checked)}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-text-primary">{item.name}</td>
                    <td className="px-6 py-4">{item.purchasePrice.toFixed(2)}€</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                        item.status === 'listed' ? 'bg-blue-900 text-blue-300' :
                        'bg-green-900 text-green-300'
                      }`}>
                        {t(item.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex flex-wrap gap-2">
                      {item.status === 'pending' && <Button onClick={() => handleGenerateListing(item)} disabled={loadingItemId === item.id} className="text-xs">{loadingItemId === item.id ? <Spinner/> : t('generate_optimized_listing')}</Button>}
                      {item.status !== 'pending' && <Button onClick={(e) => { e.stopPropagation(); handleMarkAsSold(item); }} className="text-xs bg-green-600 hover:bg-green-700">{t('mark_as_sold')}</Button>}
                    </td>
                  </tr>
                  {item.status !== 'pending' && item.generatedTitle && (
                    <tr className="bg-background border-b border-border">
                      <td colSpan={5} className="p-4">
                        <div className="p-3 bg-gray-800 rounded-lg">
                           <h5 className="font-bold text-text-primary">{item.generatedTitle}</h5>
                           <div className="prose prose-sm prose-invert text-text-secondary mt-1" dangerouslySetInnerHTML={{ __html: marked(item.generatedDesc || '') }} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsSellModalOpen(true)} disabled={selectedItemIds.size === 0}>
                {t('sell_selected_items')} ({selectedItemIds.size})
            </Button>
        </div>
      </div>
      
      {isSellModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={() => setIsSellModalOpen(false)}>
            <div className="bg-surface p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h4 className="text-lg font-bold text-text-primary mb-4">{t('select_platforms')}</h4>
                <div className="space-y-3 mb-6">
                    <div className="flex items-center">
                        <input type="checkbox" id="ebay-check" name="ebay" checked={platforms.ebay} onChange={handlePlatformChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                        <label htmlFor="ebay-check" className="ml-3 text-text-secondary select-none">eBay</label>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="kleinanzeigen-check" name="kleinanzeigen" checked={platforms.kleinanzeigen} onChange={handlePlatformChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                        <label htmlFor="kleinanzeigen-check" className="ml-3 text-text-secondary select-none">Kleinanzeigen</label>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="youtube-check" name="youtube" checked={platforms.youtube} onChange={handlePlatformChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                        <label htmlFor="youtube-check" className="ml-3 text-text-secondary select-none">YouTube</label>
                    </div>
                </div>
                <div className="flex justify-end gap-4">
                    <Button onClick={() => setIsSellModalOpen(false)} className="bg-gray-600 hover:bg-gray-700">{t('cancel')}</Button>
                    <Button onClick={handleGenerateFiles} disabled={!Object.values(platforms).some(v => v)}>
                        {t('generate_listing_files')}
                    </Button>
                </div>
            </div>
        </div>
      )}
    </Card>
  )
};

const PurchaseAndListing: React.FC = () => {
    const { t } = useLanguage();
    const [activeSubTab, setActiveSubTab] = useState('chat');
    
    const renderContent = () => {
        switch (activeSubTab) {
            case 'chat': return <AnkaufChat />;
            case 'tools': return <InseratTools />;
            default: return <AnkaufChat />;
        }
    };

    return (
        <div>
            <div className="flex border-b border-border mb-6 sticky top-[129px] bg-background z-30 overflow-x-auto">
                <button onClick={() => setActiveSubTab('chat')} className={`py-3 px-6 font-medium whitespace-nowrap ${activeSubTab === 'chat' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}>{t('subtab_purchase_chat')}</button>
                <button onClick={() => setActiveSubTab('tools')} className={`py-3 px-6 font-medium whitespace-nowrap ${activeSubTab === 'tools' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}>{t('subtab_listing_tools')}</button>
            </div>
            <div className="px-4 md:px-6">
              {renderContent()}
            </div>
        </div>
    )
};


const GenerativeTools: React.FC = () => {
    const { t } = useLanguage();
    // Image Gen State
    const [imagePrompt, setImagePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    
    // Video Gen State
    const [videoPrompt, setVideoPrompt] = useState('');
    const [startImage, setStartImage] = useState<File | null>(null);
    const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    
    // Image Edit State
    const [editPrompt, setEditPrompt] = useState('');
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [originalImagePreview, setOriginalImagePreview] = useState<string|null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [isEditingImage, setIsEditingImage] = useState(false);


    const handleGenerateImage = async () => {
        if (!imagePrompt) return;
        setIsGeneratingImage(true);
        setGeneratedImage(null);
        try {
            const imageUrl = await gemini.generateImage(imagePrompt, aspectRatio);
            setGeneratedImage(imageUrl);
        } catch (error) {
            console.error("Image generation failed", error);
            alert(t('error_message'));
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!videoPrompt) return;
        setIsGeneratingVideo(true);
        setGeneratedVideo(null);
        try {
            const videoUrl = await gemini.generateVideo(videoPrompt, startImage, videoAspectRatio);
            setGeneratedVideo(videoUrl);
        } catch (error) {
            console.error("Video generation failed", error);
            alert(`${t('error_message')}: ${(error as Error).message}`);
        } finally {
            setIsGeneratingVideo(false);
        }
    };
    
    const handleEditImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setEditImageFile(file);
            setOriginalImagePreview(URL.createObjectURL(file));
            setEditedImage(null);
        }
    };
    
    const handleEditImage = async () => {
        if (!editPrompt || !editImageFile) return;
        setIsEditingImage(true);
        setEditedImage(null);
        try {
            const imageUrl = await gemini.editImage(editPrompt, editImageFile);
            setEditedImage(imageUrl);
        } catch (error) {
            console.error("Image editing failed", error);
            alert(t('error_message'));
        } finally {
            setIsEditingImage(false);
        }
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 md:px-6">
            <Card>
                <h3 className="text-xl font-bold text-text-primary mb-1">{t('image_gen_title')}</h3>
                <p className="text-text-secondary mb-4">{t('image_gen_desc')}</p>
                <div className="space-y-4">
                    <TextArea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder={t('image_prompt_placeholder')} />
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-text-primary">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                        <option value="3:4">3:4 (Tall)</option>
                    </select>
                    <Button onClick={handleGenerateImage} disabled={isGeneratingImage || !imagePrompt}>{isGeneratingImage ? t('generating') : t('generate_image')}</Button>
                </div>
                {isGeneratingImage && <div className="mt-4"><Spinner /></div>}
                {generatedImage && <img src={generatedImage} alt="Generated" className="mt-4 rounded-lg w-full" />}
            </Card>

            <Card>
                <h3 className="text-xl font-bold text-text-primary mb-1">{t('video_gen_title')}</h3>
                <p className="text-text-secondary mb-4">{t('video_gen_desc')}</p>
                 <div className="space-y-4">
                    <TextArea value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder={t('video_prompt_placeholder')} />
                    <select value={videoAspectRatio} onChange={e => setVideoAspectRatio(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-text-primary">
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                    <div>
                        <label className="text-text-secondary text-sm">{t('upload_image')} (optional start frame)</label>
                        <input type="file" accept="image/*" onChange={(e) => setStartImage(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover"/>
                    </div>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline">Billing information</a>
                    <Button onClick={handleGenerateVideo} disabled={isGeneratingVideo || !videoPrompt}>{isGeneratingVideo ? t('generating') : t('generate_video')}</Button>
                </div>
                {isGeneratingVideo && <div className="mt-4 text-center text-text-secondary">Generating video... This can take a few minutes.</div>}
                {generatedVideo && <video src={generatedVideo} controls className="mt-4 rounded-lg w-full" />}
            </Card>
            
            <Card className="lg:col-span-2">
                <h3 className="text-xl font-bold text-text-primary mb-1">{t('edit_image_title')}</h3>
                <p className="text-text-secondary mb-4">{t('edit_image_desc')}</p>
                <div className="space-y-4">
                   <input type="file" accept="image/*" onChange={handleEditImageFileChange} className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover"/>
                    <TextArea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder={t('edit_image_prompt_placeholder')} />
                    <Button onClick={handleEditImage} disabled={isEditingImage || !editPrompt || !editImageFile}>{isEditingImage ? t('generating') : t('generate_image')}</Button>
                </div>
                {isEditingImage && <div className="mt-4"><Spinner /></div>}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {originalImagePreview && (
                        <div>
                            <h4 className="text-text-secondary font-semibold mb-2">Original</h4>
                            <img src={originalImagePreview} alt="Original to edit" className="rounded-lg w-full" />
                        </div>
                    )}
                    {editedImage && (
                        <div>
                            <h4 className="text-text-secondary font-semibold mb-2">Edited</h4>
                            <img src={editedImage} alt="Edited result" className="rounded-lg w-full" />
                        </div>
                    )}
                </div>
            </Card>

        </div>
    );
};


const Research: React.FC = () => {
    const { t } = useLanguage();
    const [prompt, setPrompt] = useState('');
    const [useMaps, setUseMaps] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState('');
    const [sources, setSources] = useState<{uri: string, title: string}[]>([]);

    const handleResearch = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setResultText('');
        setSources([]);
        try {
            const response = await gemini.researchWithGrounding(prompt, useMaps);
            setResultText(response.text);
            const metadata = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (metadata) {
                const extractedSources = metadata.map((chunk: any) => {
                    if (chunk.web) return { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri };
                    if (chunk.maps) return { uri: chunk.maps.uri, title: chunk.maps.title || 'Google Maps Link'};
                    return null;
                }).filter(Boolean);
                setSources(extractedSources);
            }
        } catch (error) {
            console.error("Research failed", error);
            setResultText(t('error_message'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="px-4 md:px-6">
            <Card>
                <h3 className="text-xl font-bold text-text-primary mb-1">{t('research_title')}</h3>
                <p className="text-text-secondary mb-4">{t('research_desc')}</p>
                <div className="space-y-4">
                    <TextArea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t('research_prompt_placeholder')} />
                    <div className="flex items-center">
                        <input type="checkbox" id="use-maps" checked={useMaps} onChange={e => setUseMaps(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <label htmlFor="use-maps" className="ml-2 block text-sm text-text-secondary">{t('use_maps')}</label>
                    </div>
                    <Button onClick={handleResearch} disabled={isLoading || !prompt}>{isLoading ? t('processing') : t('research')}</Button>
                </div>
                {isLoading && <div className="mt-4"><Spinner /></div>}
                {resultText && (
                    <div className="mt-6 p-4 bg-background rounded-lg border border-border">
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked(resultText) }} />
                        {sources.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-text-primary">Sources:</h4>
                                <ul className="list-disc list-inside space-y-1 mt-2">
                                    {sources.map((source, index) => (
                                        <li key={index}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{source.title}</a></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};


const AiChat: React.FC = () => {
    const { t } = useLanguage();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const chatRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatRef.current = gemini.startChat();
    }, []);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };
    
    const handleSubmit = async () => {
        if (!input.trim() || isLoading) return;
        const userInput = input;
        const userImage = image;
        const userImagePreview = imagePreview;

        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: userInput, image: userImagePreview || undefined };
        setMessages(prev => [...prev, userMessage]);
        
        setIsLoading(true);
        setInput('');
        setImage(null);
        setImagePreview(null);
        
        const modelMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '' }]);
        
        try {
            const stream = await gemini.sendMessageStream(chatRef.current, userInput, userImage || undefined);
            for await (const chunk of stream) {
                // Fix: The `text` property on a `GenerateContentResponse` is a string, not a function.
                const chunkText = chunk.text;
                setMessages(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, text: msg.text + chunkText } : msg));
            }
        } catch (error) {
             console.error(error);
             setMessages(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, text: t('error_message') } : msg));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="px-4 md:px-6">
            <Card>
                <h3 className="text-xl font-bold text-text-primary mb-1">{t('chat_title')}</h3>
                <p className="text-text-secondary mb-4">{t('chat_desc')}</p>
                <div className="h-[calc(100vh-320px)] bg-background rounded-lg p-4 overflow-y-auto flex flex-col space-y-4 border border-border">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-700 text-text-primary'}`}>
                          {msg.image && <img src={msg.image} alt="User upload" className="rounded-lg mb-2 max-h-48" />}
                           <div dangerouslySetInnerHTML={{ __html: marked(msg.text) }} className="prose prose-invert prose-sm"></div>
                        </div>
                      </div>
                    ))}
                    {isLoading && messages[messages.length-1]?.role !== 'model' && 
                        <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-700"><Spinner /></div></div>}
                    <div ref={messagesEndRef} />
                </div>
                <div className="mt-4 flex items-center space-x-2">
                    <input type="file" accept="image/*" id="chat-image-upload" className="hidden" onChange={handleImageChange} />
                    <label htmlFor="chat-image-upload" className="cursor-pointer p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    </label>
                    <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t('chat_placeholder')} />
                    <Button onClick={handleSubmit} disabled={isLoading || !input.trim()}>{t('send')}</Button>
                </div>
                {imagePreview && <div className="mt-2 text-sm text-text-secondary">{t('upload_image')}: {image?.name}</div>}
            </Card>
        </div>
    );
};

// --- Saha Operatoru Types ---
type DecisionItem = {
    id: string;
    title: string;
    price: string;
    imageUrl: string;
    description: string;
};
type LogStep = { type: 'log'; message: string; delay: number; };
type DecisionStep = { type: 'decision'; delay: number; item: DecisionItem };
type AgentStep = LogStep | DecisionStep;


export const SahaOperatoru: React.FC = () => {
    const { t } = useLanguage();
    const [agentStatus, setAgentStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>('idle');
    const [log, setLog] = useState<string[]>([]);
    const [config, setConfig] = useState({
        targetPlatform: 'eBay',
        searchQuery: 'defektes macbook pro',
        maxBudget: '200',
        messageTemplate: 'Merhaba, ürünle ilgileniyorum. Son fiyatınız nedir?',
    });
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [decisionItem, setDecisionItem] = useState<DecisionItem | null>(null);

    const stepProcessorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    
    const agentSimulationSteps = useCallback((query: string, platform: string, budget: string): AgentStep[] => [
        { type: 'log', delay: 500, message: `[INIT] Operatör başlatılıyor... Hedef: ${platform}.` },
        { type: 'log', delay: 1000, message: `[NAV] ${platform.toLowerCase()}.de adresine gidiliyor...` },
        { type: 'log', delay: 1200, message: '[AUTH] Güvenli kasadan alınan bilgilerle giriş yapılıyor...' },
        { type: 'log', delay: 1500, message: '[SUCCESS] Oturum açma başarılı.' },
        { type: 'log', delay: 800, message: `[SEARCH] "${query}" için arama yapılıyor...` },
        { type: 'log', delay: 1800, message: '[RESULT] 5 yeni ilan bulundu.' },
        { type: 'log', delay: 500, message: '[ANALYZE] İlan #1 inceleniyor...' },
        {
            type: 'decision',
            delay: 1500,
            item: {
                id: 'item-1',
                title: 'MacBook Pro 2018 defekt',
                price: '150€',
                imageUrl: `https://loremflickr.com/320/240/macbook,broken?random=1`,
                description: 'Ekran kırık, anakart sağlam olabilir. Sadece cihazın kendisi, şarj aleti yok.'
            }
        },
        { type: 'log', delay: 500, message: '[ANALYZE] İlan #2 inceleniyor...' },
        {
            type: 'decision',
            delay: 1500,
            item: {
                id: 'item-2',
                title: 'MacBook Pro Touchbar defekt',
                price: '250€',
                imageUrl: `https://loremflickr.com/320/240/macbook,broken?random=2`,
                description: `Sıvı teması sonrası açılmıyor. Bütçenizi (${budget}€) aşıyor.`
            }
        },
        { type: 'log', delay: 1000, message: '[IDLE] Yeni ilanlar için tarama döngüsü bekleniyor...' },
    ], []);


    // Auto-scroll log
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [log]);
    
    // Cleanup timeouts on unmount or when simulation stops
    useEffect(() => {
        return () => {
            if (stepProcessorRef.current) {
                clearTimeout(stepProcessorRef.current);
            }
        };
    }, []);

    const processNextStep = useCallback(() => {
        const steps = agentSimulationSteps(config.searchQuery, config.targetPlatform, config.maxBudget);
        if (currentStepIndex >= steps.length) {
            setAgentStatus('stopped');
            setLog(prev => [...prev, "[COMPLETE] Görev tamamlandı. Operatör durduruldu."]);
            return;
        }

        const step = steps[currentStepIndex];
        stepProcessorRef.current = setTimeout(() => {
            if (step.type === 'log') {
                setLog(prev => [...prev, step.message]);
                setCurrentStepIndex(prev => prev + 1);
            } else if (step.type === 'decision') {
                setAgentStatus('paused');
                setLog(prev => [...prev, `[PAUSE] Kullanıcı kararı bekleniyor: ${step.item.title}`]);
                setDecisionItem(step.item);
            }
        }, step.delay);
    }, [currentStepIndex, config, agentSimulationSteps]);

    // Main simulation loop trigger
    useEffect(() => {
        if (agentStatus === 'running') {
            processNextStep();
        }
    }, [agentStatus, currentStepIndex, processNextStep]);
    
    const handleStartAgent = () => {
        if (stepProcessorRef.current) clearTimeout(stepProcessorRef.current);
        setLog([`[SYSTEM] ${t('agent_awaiting_start')}`]);
        setCurrentStepIndex(0);
        setDecisionItem(null);
        setLog([]);
        setAgentStatus('running');
    };

    const handleStopAgent = () => {
        if (stepProcessorRef.current) clearTimeout(stepProcessorRef.current);
        setAgentStatus('stopped');
        setLog(prev => [...prev, "[ABORT] Operatör kullanıcı tarafından durduruldu."]);
    };
    
    const handleUserDecision = (action: 'send' | 'skip') => {
      if (!decisionItem) return;
      const logMessage = action === 'send'
        ? `[ACTION] "${decisionItem.title}" için mesaj gönderiliyor...`
        : `[ACTION] "${decisionItem.title}" ilanı atlandı.`;
      
      setLog(prev => [...prev, logMessage]);
      
      if (action === 'send') {
          // Simulate message sending with another log entry
          setTimeout(() => {
            setLog(prev => [...prev, '[SUCCESS] Mesaj başarıyla gönderildi.']);
          }, 1000);
      }

      setDecisionItem(null);
      setCurrentStepIndex(prev => prev + 1);
      setAgentStatus('running');
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const isRunning = agentStatus === 'running' || agentStatus === 'paused';

    return (
        <div className="px-4 md:px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-6">
                <Card>
                    <h3 className="text-xl font-bold text-text-primary mb-1">{t('field_agent_config_title')}</h3>
                    <p className="text-text-secondary mb-4">{t('field_agent_config_desc')}</p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-text-secondary">{t('target_platform')}</label>
                            <Input name="targetPlatform" value={config.targetPlatform} onChange={handleConfigChange} placeholder="eBay, Kleinanzeigen..." />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-secondary">{t('search_query')}</label>
                            <Input name="searchQuery" value={config.searchQuery} onChange={handleConfigChange} placeholder="defektes macbook pro..." />
                        </div>
                         <div>
                            <label className="text-sm font-medium text-text-secondary">{t('max_budget')}</label>
                            <Input name="maxBudget" type="number" value={config.maxBudget} onChange={handleConfigChange} placeholder="200" />
                        </div>
                         <div>
                            <label className="text-sm font-medium text-text-secondary">{t('message_template')}</label>
                            <TextArea name="messageTemplate" value={config.messageTemplate} onChange={handleConfigChange} placeholder="Merhaba..." rows={3} />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xl font-bold text-text-primary">{t('agent_activity')}</h3>
                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-text-secondary">{t('agent_status')}:</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    agentStatus === 'running' ? 'bg-green-900 text-green-300 animate-pulse' :
                                    agentStatus === 'paused' ? 'bg-yellow-900 text-yellow-300 animate-pulse' :
                                    agentStatus === 'idle' ? 'bg-gray-700 text-gray-300' :
                                    'bg-red-900 text-red-300'
                                }`}>
                                    {t(agentStatus)}
                                </span>
                            </div>
                            <Button onClick={handleStartAgent} disabled={isRunning} className={isRunning ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'}>
                                {t('start_agent')}
                            </Button>
                            <Button onClick={handleStopAgent} disabled={!isRunning} className={!isRunning ? 'bg-gray-500' : 'bg-red-600 hover:bg-red-700'}>
                                {t('stop_agent')}
                            </Button>
                         </div>
                    </div>
                    
                    {decisionItem && (
                       <div className="mb-4 border border-primary rounded-lg p-4 bg-background shadow-lg animate-fade-in">
                          <h4 className="font-bold text-lg text-primary mb-2">{t('user_decision_needed')}</h4>
                          <div className="flex flex-col md:flex-row gap-4">
                              <img src={decisionItem.imageUrl} alt={decisionItem.title} className="w-full md:w-1/3 h-auto object-cover rounded-md" />
                              <div className="flex-1">
                                  <h5 className="font-semibold text-text-primary">{decisionItem.title}</h5>
                                  <p className="text-2xl font-bold text-green-400 my-1">{decisionItem.price}</p>
                                  <p className="text-sm text-text-secondary mb-3">{decisionItem.description}</p>
                                  <div className="flex gap-4">
                                      <Button onClick={() => handleUserDecision('send')} className="bg-green-600 hover:bg-green-700 flex-1">{t('send_message')}</Button>
                                      <Button onClick={() => handleUserDecision('skip')} className="bg-gray-600 hover:bg-gray-700 flex-1">{t('skip')}</Button>
                                  </div>
                              </div>
                          </div>
                       </div>
                    )}
                    
                    <div className="flex-grow flex flex-col">
                        <h4 className="text-lg font-semibold text-text-primary mb-2">{t('live_log')}</h4>
                        <div ref={logContainerRef} className="flex-grow bg-black text-green-400 font-mono text-sm p-4 rounded-lg overflow-y-auto h-64 border border-gray-700">
                            {log.map((line, index) => (
                                <p key={index} className="whitespace-pre-wrap">{`> ${line}`}</p>
                            ))}
                            {agentStatus === 'running' && <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-2" />}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

const AppContent: React.FC = () => {
    const [activeTab, setActiveTab] = useState('purchase_listing');
    const { t } = useLanguage();

    const handleTitleClick = () => {
        setActiveTab('purchase_listing');
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'purchase_listing': return <PurchaseAndListing />;
            case 'generative_tools': return <GenerativeTools />;
            case 'research': return <Research />;
            case 'chat': return <AiChat />;
            default: return <PurchaseAndListing />;
        }
    };
    
    // Using a separate component for the tab buttons to avoid repeating the className logic
    const TabButton: React.FC<{tabId: string, children: React.ReactNode}> = ({tabId, children}) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`py-3 px-2 md:px-4 text-sm md:text-base font-medium whitespace-nowrap transition-colors duration-200 ${
                activeTab === tabId
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="min-h-screen bg-background text-text-primary">
            <Header onTitleClick={handleTitleClick} />
            <main>
                <nav className="border-b border-border sticky top-[81px] bg-surface z-40">
                    <div className="max-w-7xl mx-auto flex justify-center items-center overflow-x-auto">
                        <TabButton tabId="purchase_listing">{t('tab_purchase_listing')}</TabButton>
                        <TabButton tabId="generative_tools">{t('tab_generative_tools')}</TabButton>
                        <TabButton tabId="research">{t('tab_research')}</TabButton>
                        <TabButton tabId="chat">{t('tab_chat')}</TabButton>
                    </div>
                </nav>
                <div className="py-6 md:py-8">
                    {renderTabContent()}
                </div>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    );
};

export default App;
