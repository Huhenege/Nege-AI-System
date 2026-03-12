// src/app/dashboard/widgets/use-dashboard-widgets.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { WidgetId, DEFAULT_ORDER, getAllWidgetIds } from './catalog';

const STORAGE_KEY = 'dashboard-widgets';

interface DashboardWidgetsState {
    order: WidgetId[];
    hidden: WidgetId[];
}

const DEFAULT_STATE: DashboardWidgetsState = {
    order: DEFAULT_ORDER,
    hidden: []
};

function loadFromStorage(): DashboardWidgetsState {
    if (typeof window === 'undefined') {
        return DEFAULT_STATE;
    }
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return DEFAULT_STATE;
        }
        
        const parsed = JSON.parse(stored) as DashboardWidgetsState;
        
        // Validate the parsed data
        if (!Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) {
            return DEFAULT_STATE;
        }
        
        const allWidgetIds = getAllWidgetIds();
        const validOrder = parsed.order.filter(id => allWidgetIds.includes(id));
        const validHidden = parsed.hidden.filter(id => allWidgetIds.includes(id));
        
        // Detect newly added widgets not present in stored order or hidden list
        const knownIds = new Set([...validOrder, ...validHidden]);
        const newWidgets = allWidgetIds.filter(id => !knownIds.has(id));
        
        // Prepend new widgets so the user sees them immediately
        const finalOrder = newWidgets.length > 0
            ? [...newWidgets, ...validOrder]
            : validOrder;
        
        return {
            order: finalOrder.length > 0 ? finalOrder : DEFAULT_ORDER,
            hidden: validHidden
        };
    } catch (e) {
        console.error('Failed to parse dashboard widgets from localStorage', e);
        return DEFAULT_STATE;
    }
}

function saveToStorage(state: DashboardWidgetsState): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save dashboard widgets to localStorage', e);
    }
}

export function useDashboardWidgets() {
    const [state, setState] = useState<DashboardWidgetsState>(DEFAULT_STATE);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const loaded = loadFromStorage();
        setState(loaded);
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever state changes (after initial load)
    useEffect(() => {
        if (isLoaded) {
            saveToStorage(state);
        }
    }, [state, isLoaded]);

    // Set the order of widgets (used after drag-and-drop)
    const setOrder = useCallback((newOrder: WidgetId[]) => {
        setState(prev => ({
            ...prev,
            order: newOrder
        }));
    }, []);

    // Hide a widget (remove from order, add to hidden)
    const hideWidget = useCallback((id: WidgetId) => {
        setState(prev => {
            // Don't hide if it's already hidden
            if (prev.hidden.includes(id)) return prev;
            
            return {
                order: prev.order.filter(wid => wid !== id),
                hidden: [...prev.hidden, id]
            };
        });
    }, []);

    // Show a widget (remove from hidden, add to order at the end or middle)
    const showWidget = useCallback((id: WidgetId, position?: 'start' | 'middle' | 'end') => {
        setState(prev => {
            // Don't add if it's already in order
            if (prev.order.includes(id)) return prev;
            
            const newHidden = prev.hidden.filter(wid => wid !== id);
            let newOrder: WidgetId[];
            
            switch (position) {
                case 'start':
                    newOrder = [id, ...prev.order];
                    break;
                case 'middle':
                    const middleIndex = Math.floor(prev.order.length / 2);
                    newOrder = [
                        ...prev.order.slice(0, middleIndex),
                        id,
                        ...prev.order.slice(middleIndex)
                    ];
                    break;
                case 'end':
                default:
                    newOrder = [...prev.order, id];
                    break;
            }
            
            return {
                order: newOrder,
                hidden: newHidden
            };
        });
    }, []);

    // Get available widgets (not in order and in hidden, or new KPI widgets)
    const getAvailableWidgets = useCallback((): WidgetId[] => {
        const allWidgetIds = getAllWidgetIds();
        return allWidgetIds.filter(id => !state.order.includes(id));
    }, [state.order]);

    // Reset to default state
    const resetToDefault = useCallback(() => {
        setState(DEFAULT_STATE);
    }, []);

    return {
        order: state.order,
        hidden: state.hidden,
        isLoaded,
        setOrder,
        hideWidget,
        showWidget,
        getAvailableWidgets,
        resetToDefault
    };
}
