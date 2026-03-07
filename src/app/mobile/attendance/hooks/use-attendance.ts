'use client';

import * as React from 'react';
import { format, addDays } from 'date-fns';
import { useFirebase, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking, updateDocumentNonBlocking, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { useToast } from '@/hooks/use-toast';
import { getDeviceId, getCurrentPosition, checkLocationWithinRange } from '@/lib/attendance';
import type { AttendanceRecord, AttendanceLocation, TimeOffRequestConfig } from '@/types/attendance';
import { buildRecurringDayMap, resolveDayType, type WorkCalendar } from '@/lib/work-calendar-utils';

export type SubmittingStep = 'idle' | 'location' | 'validating' | 'saving';

export function useAttendance() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submittingStep, setSubmittingStep] = React.useState<SubmittingStep>('idle');
    const [error, setError] = React.useState<string | null>(null);
    const [matchedLocationName, setMatchedLocationName] = React.useState<string>('');

    const { employeeProfile, isProfileLoading } = useEmployeeProfile();
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const todayString = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    // Queries
    const attendanceQuery = useMemoFirebase(({ companyPath }) => (
        employeeProfile ? query(
            tenantCollection(firestore, companyPath, 'attendance'),
            where('employeeId', '==', employeeProfile.id),
            where('date', '==', todayString)
        ) : null
    ), [firestore, employeeProfile, todayString]);

    const locationsQuery = useMemoFirebase(({ companyPath }) => (
        query(tenantCollection(firestore, companyPath, 'attendanceLocations'), where('isActive', '==', true))
    ), [firestore]);

    const timeOffConfigQuery = useMemoFirebase(({ companyPath }) => (
        firestore ? tenantDoc(firestore, companyPath, 'company', 'timeOffRequestConfig') : null
    ), [firestore]);

    const { data: attendanceRecords, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);
    const { data: locations, isLoading: isLocationsLoading } = useCollection<AttendanceLocation>(locationsQuery);
    const { data: timeOffConfig, isLoading: isTimeOffConfigLoading } = useDoc<TimeOffRequestConfig>(timeOffConfigQuery);

    // Company work calendar (single source of truth for working/non-working days)
    const workCalendarRef = useMemoFirebase(({ companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'workCalendars', 'default') : null), [firestore]);
    const { data: workCalendar, isLoading: isWorkCalendarLoading } = useDoc<WorkCalendar>(workCalendarRef as any);
    const recurringDayMap = React.useMemo(() => buildRecurringDayMap(workCalendar), [workCalendar]);

    const todaysRecord = attendanceRecords?.[0];
    const isCheckedIn = !!todaysRecord;
    const isCheckedOut = !!todaysRecord?.checkOutTime;

    // Calculate disabled dates for request calendar
    const disabledDates = React.useMemo(() => {
        if (!timeOffConfig) return [];
        const dates: (Date | { before: Date })[] = [];
        const deadlineDays = timeOffConfig.requestDeadlineDays ?? 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        dates.push({ before: today });

        let i = 0;
        let daysToAdd = 0;
        while (i < deadlineDays) {
            const nextDay = addDays(today, daysToAdd);
            const dayType = workCalendar ? resolveDayType(nextDay, workCalendar, recurringDayMap) : 'working';
            const isWorkingDay = dayType === 'working' || dayType === 'special_working' || dayType === 'half_day';
            if (isWorkingDay) {
                dates.push(nextDay);
                i++;
            }
            daysToAdd++;
        }
        return dates;
    }, [timeOffConfig, workCalendar, recurringDayMap]);

    const handleAttendance = React.useCallback(async (type: 'check-in' | 'check-out') => {
        setIsSubmitting(true);
        setSubmittingStep('location');
        setError(null);

        if (!locations || !employeeProfile || !firestore) {
            setError("Системийн тохиргоог уншиж чадсангүй.");
            setIsSubmitting(false);
            setSubmittingStep('idle');
            return;
        }

        // Device verification
        const currentDeviceId = getDeviceId();
        if (!employeeProfile.deviceId) {
            // First time - register device
            const employeeDocRef = tDoc('employees', employeeProfile.id);
            await updateDocumentNonBlocking(employeeDocRef, { deviceId: currentDeviceId });
        } else if (employeeProfile.deviceId !== currentDeviceId) {
            setError("Төхөөрөмж таарахгүй байна. Админд хандана уу.");
            setIsSubmitting(false);
            setSubmittingStep('idle');
            return;
        }

        try {
            // Get location
            const position = await getCurrentPosition();
            const { latitude, longitude } = position.coords;

            setSubmittingStep('validating');

            // Check if within any location
            const { isWithin, matchedLocationName: locName, closestDistance } = checkLocationWithinRange(
                latitude,
                longitude,
                locations
            );

            if (!isWithin) {
                setError(`Оффисоос хол байна (Ойрх: ${Math.round(closestDistance)}м). Байршлаа шалгана уу.`);
                setIsSubmitting(false);
                setSubmittingStep('idle');
                return;
            }

            setMatchedLocationName(locName);
            setSubmittingStep('saving');

            if (type === 'check-in') {
                const attendanceCol = tCollection('attendance');
                await addDocumentNonBlocking(attendanceCol, {
                    employeeId: employeeProfile.id,
                    date: todayString,
                    checkInTime: new Date().toISOString(),
                    checkInLocationName: locName,
                    status: 'PRESENT',
                    lat: latitude,
                    lng: longitude
                });
                toast({ title: `${locName} байршилд ирц бүртгэгдлээ` });
            } else if (type === 'check-out' && todaysRecord) {
                const recordDocRef = tDoc('attendance', todaysRecord.id);
                await updateDocumentNonBlocking(recordDocRef, {
                    checkOutTime: new Date().toISOString(),
                    checkOutLocationName: locName,
                    status: 'LEFT'
                });
                toast({ title: 'Явсан цаг амжилттай бүртгэгдлээ' });
            }
        } catch (geoError: any) {
            if (geoError.code === 1) {
                setError("Байршлын эрх олгогдоогүй байна. Тохиргоог шалгана уу.");
            } else if (geoError.code === 2) {
                setError("Байршил тодорхойлох боломжгүй байна.");
            } else if (geoError.code === 3) {
                setError("Байршил тодорхойлох хугацаа дууслаа. Дахин оролдоно уу.");
            } else {
                setError("Байршил тодорхойлоход алдаа гарлаа.");
            }
        } finally {
            setIsSubmitting(false);
            setSubmittingStep('idle');
        }
    }, [locations, employeeProfile, firestore, todayString, todaysRecord, toast]);

    return {
        // State
        isSubmitting,
        submittingStep,
        error,
        matchedLocationName,
        
        // Data
        employeeProfile,
        todaysRecord,
        locations,
        disabledDates,
        todayString,
        
        // Computed
        isCheckedIn,
        isCheckedOut,
        isLoading: isProfileLoading || isAttendanceLoading || isLocationsLoading || isTimeOffConfigLoading || isWorkCalendarLoading,
        
        // Actions
        handleCheckIn: () => handleAttendance('check-in'),
        handleCheckOut: () => handleAttendance('check-out'),
        clearError: () => setError(null),
    };
}
