'use client'

import { PhoneInput as ReactInternationalPhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'
import type { PhoneInputProps as ReactInternationalPhoneInputProps } from 'react-international-phone'
import { cn } from '@/lib/utils'

type PhoneInputProps = Omit<ReactInternationalPhoneInputProps, 'ref'> & {
  className?: string
  inputClassName?: string
}

export default function PhoneInput({
  className,
  inputClassName,
  value,
  inputProps,
  countrySelectorStyleProps,
  ...rest
}: PhoneInputProps) {
  const mergedInputProps = {
    autoComplete: 'tel',
    ...inputProps,
  }

  const mergedCountrySelectorStyleProps = {
    ...countrySelectorStyleProps,
    buttonStyle: {
      height: 40,
      border: '1px solid hsl(var(--input))',
      borderRight: 'none',
      backgroundColor: 'hsl(var(--background))',
      color: 'hsl(var(--foreground))',
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderTopLeftRadius: '0.375rem',
      borderBottomLeftRadius: '0.375rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      ...countrySelectorStyleProps?.buttonStyle,
    },
  }

  return (
    <ReactInternationalPhoneInput
      {...rest}
      value={typeof value === 'string' ? value : value ?? ''}
      className={cn('flex w-full items-center h-10 text-base', className)}
      inputClassName={cn(
        '!h-full !w-full border border-input rounded-md !rounded-l-none !bg-background !text-foreground font-medium',
        'focus:!ring-2 focus:!ring-ring focus:!ring-offset-2 focus:!border-ring',
        'hover:!border-ring transition-colors !pl-3 !pr-3 !border-l-0',
        'placeholder:!text-muted-foreground',
        inputClassName
      )}
      inputProps={mergedInputProps}
      countrySelectorStyleProps={mergedCountrySelectorStyleProps}
    />
  )
}



