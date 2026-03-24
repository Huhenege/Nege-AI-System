'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AppDialog = DialogPrimitive.Root;
export const AppDialogTrigger = DialogPrimitive.Trigger;
export const AppDialogPortal = DialogPrimitive.Portal;
export const AppDialogClose = DialogPrimitive.Close;

export type AppDialogSize = 'sm' | 'md' | 'lg' | 'xl';
export type AppDialogCloseTone = 'muted' | 'primary';

function getSizeClass(size: AppDialogSize) {
  switch (size) {
    case 'sm':
      return 'max-w-md';
    case 'md':
      return 'max-w-lg';
    case 'lg':
      return 'max-w-2xl';
    case 'xl':
      return 'max-w-3xl';
    default:
      return 'max-w-lg';
  }
}

export const AppDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
AppDialogOverlay.displayName = 'AppDialogOverlay';

export const AppDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: AppDialogSize;
    showClose?: boolean;
    closeTone?: AppDialogCloseTone;
    overlayClassName?: string;
    withBorder?: boolean;
  }
>(
  (
    {
      className,
      children,
      size = 'md',
      showClose = true,
      closeTone = 'muted',
      overlayClassName,
      withBorder = true,
      ...props
    },
    ref
  ) => (
    <AppDialogPortal>
      <AppDialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full translate-x-[-50%] translate-y-[-50%]',
          getSizeClass(size),
          'bg-background shadow-lg',
          withBorder ? 'border border-border' : 'border-0',
          'rounded-2xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className
        )}
        aria-describedby={undefined}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded-md p-1',
              'transition-opacity',
              closeTone === 'primary' ? 'text-primary' : 'text-muted-foreground',
              'hover:opacity-100 opacity-80',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:pointer-events-none'
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </AppDialogPortal>
  )
);
AppDialogContent.displayName = 'AppDialogContent';

export function AppDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1.5', className)} {...props} />;
}

export const AppDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-xl font-semibold tracking-tight', className)}
    {...props}
  />
));
AppDialogTitle.displayName = 'AppDialogTitle';

export const AppDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AppDialogDescription.displayName = 'AppDialogDescription';

export function AppDialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />;
}

export function AppDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2',
        'border-t bg-background px-6 py-4',
        className
      )}
      {...props}
    />
  );
}

