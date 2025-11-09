import React, { useState, useCallback, useRef, useEffect, MouseEvent } from 'react';
import type { Language, TranslationSet, Translations, CsvData, GeneratedListing } from './types';

// Fix: Moved SpeechRecognition and SpeechRecognitionStatic interfaces into `declare global` to make them available across the application and fix the "Cannot find name 'SpeechRecognition'" error.
// --- Type Augmentation for Speech Recognition API ---
declare global {
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

  interface SpeechRecognitionStatic {
      new(): SpeechRecognition;
  }

  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    aistudio?: AIStudio;
  }
}

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

export const downloadFile = (content: string, fileName: string, contentType: string) => {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
};

export const parseCSV = (csvText: string): CsvData[] => {
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

export const toCSV = (data: GeneratedListing[]): string => {
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

export const Button: React.FC<{ children: React.ReactNode; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; className?: string, disabled?: boolean, type?: 'button' | 'submit' | 'reset' }> = ({ children, onClick, className = '', disabled=false, type='button' }) => (
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

export const Input: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; type?: string, onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; name?: string }> = ({ value, onChange, placeholder, type = 'text', onKeyDown, name }) => (
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

export const TextArea: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string; rows?: number; name?: string; }> = ({ value, onChange, placeholder, rows=4, name }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    name={name}
    className="w-full bg-background border border-border rounded-lg p-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
  />
);

export const Spinner: React.FC = () => (
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
