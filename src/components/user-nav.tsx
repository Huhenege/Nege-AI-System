'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { signOut } from 'firebase/auth';
import { clearSessionCookie } from '@/lib/session';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from './ui/skeleton';
import { LogOut, Settings, User, Lock } from 'lucide-react';
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from '@/components/ui/sidebar';
import { ChangePasswordDialog } from './change-password-dialog';

export function UserNav() {
    const { employeeProfile, isUserLoading, isProfileLoading } = useEmployeeProfile();
    const auth = useAuth();
    const router = useRouter();
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);

    const handleLogout = async () => {
        if (!auth) return;
        clearSessionCookie();
        await signOut(auth);
        router.push('/login');
    };

    if (isUserLoading || isProfileLoading || !employeeProfile) {
        return (
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={employeeProfile?.photoURL} alt={employeeProfile?.firstName || "User Avatar"} />
                        <AvatarFallback>{employeeProfile?.firstName?.charAt(0) || 'Б'}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{employeeProfile?.firstName || 'Хэрэглэгч'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {employeeProfile?.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        <span>Профайл</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)}>
                        <Lock className="mr-2 h-4 w-4" />
                        <span>Нууц үг солих</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Гарах</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
            <ChangePasswordDialog
                open={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
            />
        </DropdownMenu>
    );
}
