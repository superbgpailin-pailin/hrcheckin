import React, { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import { MOCK_SITES, type Site } from '../data/mockSites';

interface SiteContextType {
    sites: Site[];
    addSite: (site: Omit<Site, 'id'>) => void;
    updateSite: (site: Site) => void;
    deleteSite: (id: string) => void;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export const SiteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [sites, setSites] = useState<Site[]>(() => {
        const saved = localStorage.getItem('hr_sites');
        return saved ? JSON.parse(saved) : MOCK_SITES;
    });

    useEffect(() => {
        localStorage.setItem('hr_sites', JSON.stringify(sites));
    }, [sites]);

    const addSite = (site: Omit<Site, 'id'>) => {
        const newSite = { ...site, id: Date.now().toString() };
        setSites(prev => [...prev, newSite]);
    };

    const updateSite = (updatedSite: Site) => {
        setSites(prev => prev.map(s => s.id === updatedSite.id ? updatedSite : s));
    };

    const deleteSite = (id: string) => {
        setSites(prev => prev.filter(s => s.id !== id));
    };

    return (
        <SiteContext.Provider value={{ sites, addSite, updateSite, deleteSite }}>
            {children}
        </SiteContext.Provider>
    );
};

export const useSite = () => {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
};
