import type { CSSProperties } from "react";

export const brandThemeIds = ["burger_night", "cafe_warm", "fresh_natural", "wine_gold"] as const;
export type BrandThemeId = (typeof brandThemeIds)[number];
export type BrandTheme = { id: BrandThemeId; name: string; description: string; suitableFor: string; dark: boolean; colors: { background:string; surface:string; sidebar:string; primary:string; accent:string; secondary:string; text:string; muted:string; border:string } };

export const brandThemes: Record<BrandThemeId, BrandTheme> = {
  burger_night:{id:"burger_night",name:"Burger Noturno",description:"Grafite com verde vibrante",suitableFor:"Hamburguerias, lanchonetes e delivery",dark:true,colors:{background:"#0F1012",surface:"#1B1D20",sidebar:"#111315",primary:"#22C83A",accent:"#22C83A",secondary:"#30343A",text:"#F8FAFC",muted:"#B9C0C9",border:"#34383E"}},
  cafe_warm:{id:"cafe_warm",name:"Café & Confeitaria",description:"Creme, café e terracota",suitableFor:"Cafeterias, padarias, docerias e confeitarias",dark:false,colors:{background:"#FFF8ED",surface:"#FFFCF7",sidebar:"#3B241A",primary:"#C85C3B",accent:"#D6A756",secondary:"#66734A",text:"#3B241A",muted:"#75635A",border:"#E8D8C6"}},
  fresh_natural:{id:"fresh_natural",name:"Fresco & Natural",description:"Petróleo, menta e coral",suitableFor:"Açaí, sucos, saladas e alimentação saudável",dark:false,colors:{background:"#F5FBF7",surface:"#FFFFFF",sidebar:"#073B3A",primary:"#3DBE8B",accent:"#FF725E",secondary:"#F2B84B",text:"#123735",muted:"#58706E",border:"#D7E9E1"}},
  wine_gold:{id:"wine_gold",name:"Vinho & Ouro",description:"Vinho, marfim e dourado",suitableFor:"Pizzarias, restaurantes, churrascarias e bares",dark:false,colors:{background:"#FFF9F0",surface:"#FFFFFF",sidebar:"#641B2E",primary:"#641B2E",accent:"#C99A3D",secondary:"#D84932",text:"#42141F",muted:"#765D62",border:"#E8D8D2"}},
};

export function isBrandThemeId(value:unknown):value is BrandThemeId{return typeof value==="string"&&brandThemeIds.includes(value as BrandThemeId)}
export function getBrandTheme(value:unknown):BrandTheme{if(value==="dark")return brandThemes.burger_night;if(value==="light")return brandThemes.cafe_warm;return brandThemes[isBrandThemeId(value)?value:"burger_night"]}
export function themeStyle(theme:BrandTheme):CSSProperties{return {"--mf-bg":theme.colors.background,"--mf-surface":theme.colors.surface,"--mf-sidebar":theme.colors.sidebar,"--mf-primary":theme.colors.primary,"--mf-accent":theme.colors.accent,"--mf-secondary":theme.colors.secondary,"--mf-text":theme.colors.text,"--mf-muted":theme.colors.muted,"--mf-border":theme.colors.border} as CSSProperties}
