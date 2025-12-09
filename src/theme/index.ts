import { DefaultTheme, Theme } from '@react-navigation/native';

import { colors } from './colors';
import { typography } from './typography';

export const appNavigationTheme: Theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.brandNavy,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
    },
};

export const theme = {
    colors,
    typography,
};

export type AppTheme = typeof theme;
