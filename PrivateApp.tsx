import React, { useState, useCallback, useRef, useEffect, MouseEvent } from 'react';
import type { GeneratedListing } from './types';
import * as gemini from './services/geminiService';
import { marked } from 'marked';

// Import shared components from the new shared.tsx file
import {
    LanguageProvider,
    useLanguage,
    Header,
    Card,
    Button,
    Input,
    TextArea,
    Spinner,
    downloadFile
} from './shared';


// --- App-Specific Types ---
export type InventoryItem = {
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


// --- MODULES ---

const AgentConfig: React.FC = () => {
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

const SalesAgent: React.FC = () => {
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


const SahaOperatoru: React.FC = () => {
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

const PrivateAppContent: React.FC = () => {
    const [activeTab, setActiveTab] = useState('field_agent');
    const { t } = useLanguage();

    const handleTitleClick = () => {
        setActiveTab('field_agent');
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'field_agent': return <SahaOperatoru />;
            case 'purchase_agent': return <AgentConfig />;
            case 'sales_agent': return <SalesAgent />;
            default: return <SahaOperatoru />;
        }
    };
    
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
            <Header onTitleClick={handleTitleClick} titleKey="title" />
            <main>
                <nav className="border-b border-border sticky top-[81px] bg-surface z-40">
                    <div className="max-w-7xl mx-auto flex justify-center items-center overflow-x-auto">
                        <TabButton tabId="field_agent">{t('tab_field_agent')}</TabButton>
                        <TabButton tabId="purchase_agent">{t('subtab_purchase_agent')}</TabButton>
                        <TabButton tabId="sales_agent">{t('subtab_sales_agent')}</TabButton>
                    </div>
                </nav>
                <div className="py-6 md:py-8">
                    {renderTabContent()}
                </div>
            </main>
        </div>
    );
};

const PrivateApp: React.FC = () => {
    return (
      <LanguageProvider>
        <PrivateAppContent />
      </LanguageProvider>
    );
};

export default PrivateApp;
