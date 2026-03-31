import type { ThemeConfig } from 'antd';
import { appThemeTokens } from './tokens';

export const antThemeConfig: ThemeConfig = {
  token: {
    colorPrimary: appThemeTokens.primary,
    colorInfo: appThemeTokens.info,
    colorSuccess: appThemeTokens.success,
    colorWarning: appThemeTokens.warning,
    colorError: appThemeTokens.error,
    colorBgBase: appThemeTokens.surface,
    colorBgContainer: appThemeTokens.surface,
    colorBgElevated: appThemeTokens.surface,
    colorBorder: appThemeTokens.border,
    colorBorderSecondary: appThemeTokens.border,
    colorText: appThemeTokens.textPrimary,
    colorTextSecondary: appThemeTokens.textSecondary,
    colorTextTertiary: appThemeTokens.textTertiary,
    borderRadius: appThemeTokens.radiusMd,
    borderRadiusLG: appThemeTokens.radiusLg,
    borderRadiusSM: appThemeTokens.radiusSm,
    boxShadow: appThemeTokens.shadowSm,
    boxShadowSecondary: appThemeTokens.shadowMd,
    fontFamily: '"IBM Plex Sans","PingFang SC","Microsoft YaHei",sans-serif',
  },
  components: {
    Layout: {
      headerBg: 'transparent',
      siderBg: '#0B1220',
      bodyBg: 'transparent',
      triggerBg: '#101828',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(24, 195, 230, 0.18)',
      darkItemSelectedColor: '#F8FAFC',
      darkItemColor: 'rgba(226, 232, 240, 0.78)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
    },
    Card: {
      bodyPadding: 20,
      bodyPaddingSM: 16,
      headerPadding: 20,
      headerPaddingSM: 16,
    },
    Table: {
      headerBg: '#F8FAFC',
      headerColor: appThemeTokens.textSecondary,
      borderColor: appThemeTokens.border,
      rowHoverBg: '#F7FBFF',
    },
    Input: {
      activeBorderColor: appThemeTokens.primary,
      hoverBorderColor: appThemeTokens.primary,
    },
    Select: {
      activeBorderColor: appThemeTokens.primary,
      hoverBorderColor: appThemeTokens.primary,
    },
    Tabs: {
      itemActiveColor: appThemeTokens.primary,
      itemSelectedColor: appThemeTokens.primary,
      inkBarColor: appThemeTokens.accent,
    },
    Statistic: {
      contentFontSize: 32,
    },
  },
};
