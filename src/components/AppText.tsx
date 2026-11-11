import React, { forwardRef } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { typography } from '../theme/typography';

// Provide a readable default for labels without a screen-specific font size.
// Native accessibility scaling and all other Text props are preserved.
export const AppText = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => <NativeText ref={ref} {...props} style={[{ fontSize: typography.body }, style]} />,
);
AppText.displayName = 'AppText';
