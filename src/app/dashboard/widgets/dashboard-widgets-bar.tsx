// src/app/dashboard/widgets/dashboard-widgets-bar.tsx
'use client';

import React, { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetId, getAllWidgetIds, getWidgetConfig } from './catalog';
import { DashboardWidgetCard, WidgetData } from './dashboard-widget-card';
import { AddWidgetDialog } from './add-widget-dialog';
import type { SaaSModule, CompanyPlan } from '@/types/company';

interface DashboardWidgetsBarProps {
    order: WidgetId[];
    hidden: WidgetId[];
    onOrderChange: (newOrder: WidgetId[]) => void;
    onHideWidget: (id: WidgetId) => void;
    onShowWidget: (id: WidgetId) => void;
    data: WidgetData;
    isLoading?: boolean;
    isModuleEnabled?: (module: SaaSModule) => boolean;
    currentPlan?: CompanyPlan;
}

export function DashboardWidgetsBar({
    order,
    hidden,
    onOrderChange,
    onHideWidget,
    onShowWidget,
    data,
    isLoading = false,
    isModuleEnabled,
    currentPlan = 'free',
}: DashboardWidgetsBarProps) {
    const [activeId, setActiveId] = useState<WidgetId | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement to start dragging (allows clicks)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as WidgetId);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = order.indexOf(active.id as WidgetId);
            const newIndex = order.indexOf(over.id as WidgetId);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(order, oldIndex, newIndex);
                onOrderChange(newOrder);
            }
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    // Check if there are available widgets to add
    const totalWidgetCount = getAllWidgetIds().length;
    const hasAvailableWidgets = hidden.length > 0 || order.length < totalWidgetCount;

    // Build items array - widgets only
    const isWidgetLocked = (widgetId: WidgetId): boolean => {
        if (!isModuleEnabled) return false;
        const cfg = getWidgetConfig(widgetId);
        if (!cfg?.module) return false;
        return !isModuleEnabled(cfg.module);
    };

    const visibleOrder = order.filter(id => !isWidgetLocked(id));

    const renderItems = () => {
        return visibleOrder.map((widgetId) => (
            <DashboardWidgetCard
                key={widgetId}
                id={widgetId}
                data={data}
                isLoading={isLoading}
                onHide={onHideWidget}
                isDragging={activeId === widgetId}
            />
        ));
    };

    return (
        <>
            <div className="h-[20vh] min-h-[220px] border-b bg-slate-50 dark:bg-slate-950 relative">
                <div className="h-full overflow-x-auto overflow-y-hidden px-3 sm:px-6 py-3 sm:py-4 min-[1280px]:scrollbar-hide">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                    >
                        <SortableContext
                            items={visibleOrder}
                            strategy={horizontalListSortingStrategy}
                        >
                            <div className="flex gap-3 sm:gap-6 h-full min-w-max pr-14 sm:pr-12">
                                {renderItems()}
                            </div>
                        </SortableContext>

                        {/* Drag overlay for better visual feedback */}
                        <DragOverlay>
                            {activeId ? (
                                <div className="opacity-80">
                                    <DashboardWidgetCard
                                        id={activeId}
                                        data={data}
                                        isLoading={isLoading}
                                        isDragging
                                    />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>

                {/* Floating Add Button: жижиг дэлгэцэнд баруун доод буланд, том дэлгэцэнд доод төвд */}
                {hasAvailableWidgets && (
                    <Button
                        size="icon"
                        className={cn(
                            "absolute z-20 rounded-full shadow-lg",
                            "right-3 bottom-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:-bottom-5",
                            "h-9 w-9 sm:h-10 sm:w-10",
                            "bg-primary hover:bg-primary/90 hover:scale-110",
                            "transition-all duration-200"
                        )}
                        onClick={() => setIsAddDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="sr-only">Widget нэмэх</span>
                    </Button>
                )}
            </div>

            {/* Add Widget Dialog */}
            <AddWidgetDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                currentOrder={order}
                hidden={hidden}
                onAddWidget={onShowWidget}
                isModuleEnabled={isModuleEnabled}
                currentPlan={currentPlan}
            />
        </>
    );
}
