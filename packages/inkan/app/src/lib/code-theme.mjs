/** The one syntax theme for code blocks: the panel is dark in Day and in Stage. */
import { ExpressiveCodeTheme } from 'astro-expressive-code';

/** @type {{ fg: string, bg: string, bar: string, keyword: string, type: string, literal: string, comment: string }} */
const palette = { fg: '#E8ECF5', bg: '#0B0D14', bar: '#151925', keyword: '#FF8AC4', type: '#2BD4FF', literal: '#FFB067', comment: '#8D98B8' };

export const codeTheme = new ExpressiveCodeTheme({
  name: 'overprint',
  type: 'dark',
  colors: { 'editor.background': palette.bg, 'editor.foreground': palette.fg },
  settings: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: palette.comment } },
    {
      scope: ['keyword', 'storage', 'keyword.operator.new', 'variable.language', 'constant.language', 'entity.name.tag', 'meta.diff.header'],
      settings: { foreground: palette.keyword },
    },
    {
      scope: ['string', 'constant.numeric', 'constant.character', 'constant.other.color', 'markup.inline.raw', 'punctuation.definition.string'],
      settings: { foreground: palette.literal },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.name.function', 'support.function', 'entity.other.attribute-name', 'support.type.property-name', 'meta.object-literal.key', 'entity.name.tag.yaml'],
      settings: { foreground: palette.type },
    },
    { scope: ['markup.heading', 'markup.bold'], settings: { foreground: palette.type, fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
  ],
});

/** @type {import('astro-expressive-code').StyleOverrides} */
export const codeStyleOverrides = {
  borderRadius: '6px',
  borderWidth: '1.5px',
  borderColor: 'var(--inkan-rule-strong)',
  codeFontFamily: 'var(--inkan-font-mono)',
  codeFontSize: '11.5px',
  codeLineHeight: '1.75',
  codePaddingBlock: '0.6rem',
  uiFontFamily: 'var(--inkan-font-mono)',
  uiFontSize: '10.5px',
  textMarkers: {
    markBackground: 'rgba(255, 234, 74, .12)',
    markBorderColor: '#FFEA4A',
    insBackground: 'rgba(43, 234, 138, .14)',
    insBorderColor: '#2BEA8A',
    delBackground: 'rgba(255, 90, 80, .15)',
    delBorderColor: '#FF6B5A',
    lineMarkerAccentWidth: '3px',
  },
  lineNumbers: { foreground: '#8D97B5', highlightForeground: palette.fg },
  frames: {
    editorBackground: palette.bg,
    editorTabBarBackground: palette.bar,
    editorActiveTabBackground: palette.bar,
    editorActiveTabForeground: '#9AA6C2',
    editorActiveTabBorderColor: 'transparent',
    editorActiveTabIndicatorTopColor: 'transparent',
    editorActiveTabIndicatorBottomColor: 'transparent',
    editorTabBarBorderBottomColor: 'rgba(255, 255, 255, .12)',
    terminalBackground: palette.bg,
    terminalTitlebarBackground: palette.bar,
    terminalTitlebarForeground: '#9AA6C2',
    terminalTitlebarDotsForeground: 'transparent',
    terminalTitlebarBorderBottomColor: 'rgba(255, 255, 255, .12)',
    frameBoxShadowCssValue: 'none',
  },
};
