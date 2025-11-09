import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CsvData, GeneratedListing, ChatMessage } from './types';
import * as gemini from './services/geminiService';
import { marked } from 'marked';

// Import the shared components from PrivateApp.tsx
import {
    LanguageProvider,
    useLanguage,
    Header,
    Card,
    Button,
    Input,
    TextArea,
    Spinner,
    parseCSV,
    downloadFile,
    toCSV
} from './PrivateApp';


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
