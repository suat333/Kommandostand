import React, { useState } from 'react';
import { LanguageProvider, useLanguage, Header, AgentConfig, SalesAgent, SahaOperatoru } from './App';

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
