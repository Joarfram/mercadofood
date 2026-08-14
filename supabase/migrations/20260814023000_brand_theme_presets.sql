alter table public.companies drop constraint if exists companies_menu_theme_check;
update public.companies set menu_theme=case menu_theme when 'dark' then 'burger_night' when 'light' then 'cafe_warm' else 'burger_night' end;
alter table public.companies alter column menu_theme set default 'burger_night';
alter table public.companies add constraint companies_menu_theme_check check (menu_theme in ('burger_night','cafe_warm','fresh_natural','wine_gold'));
