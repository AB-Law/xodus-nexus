import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountGames, Cover, GameLaunchToolFields, GameTitle, HomePage, LibraryPagination, Sidebar, type LibraryFilters } from './App';
import { defaultLaunchTools } from '../shared/launch-tools';
import { demoSnapshot } from '../shared/demo-data';

it('keeps one My Library and Store navigation, no separate Game Pass page',()=>{
  const html=renderToStaticMarkup(<Sidebar data={demoSnapshot()} page="library" go={()=>{}} />);
  expect(html).toContain('My Library'); expect(html).toContain('Store');
  expect(html).not.toContain('<span>Game Pass</span>');
});
it('restores the parent-owned filters after the library is recreated',()=>{
  const filters: LibraryFilters = { kind: 'owned', playState: 'installed', query: 'Edition' };
  const data=demoSnapshot(); data.auth={running:false,stored:false,note:''};
  const library=()=>renderToStaticMarkup(<AccountGames data={data} toast={()=>{}} filters={filters} onFiltersChange={()=>{}} />);
  for(const html of [library(),library()]) {
    expect(html).toContain('<option value="owned" selected="">');
    expect(html).toContain('<option value="installed" selected="">');
    expect(html).toContain('value="Edition"');
    expect(html).not.toContain('<option value="all" selected="">');
  }
});
it('offers Access and Play state filters without cloud streaming, preserving installed games offline',()=>{
  const data=demoSnapshot(); data.auth={running:false,stored:false,note:''};
  const html=renderToStaticMarkup(<AccountGames data={data} toast={()=>{}} />);
  expect(html).toContain('aria-label="Access"'); expect(html).toContain('In Game Pass'); expect(html).toContain('Owned');
  expect(html).toContain('aria-label="Play state"'); expect(html).toContain('Ready to install');
  expect(html).not.toContain('Cloud playable'); expect(html).toContain('Installed games remain available');
  expect(html).toContain(data.games[0].title);
  expect(html).not.toContain('Owned · Installed');
  expect(html).toContain(`title="${data.games[0].title}"`);
});

it('preserves full edition names in native hover tooltips and escapes special characters',()=>{
  const html=renderToStaticMarkup(<GameTitle title={'A Long Game Name: "Complete" & Deluxe Edition (PC)'} />);
  expect(html).toContain('title="A Long Game Name: &quot;Complete&quot; &amp; Deluxe Edition (PC)"');
});

it('uses Store box art instead of a package logo and wide artwork for details',()=>{
  const game={ ...demoSnapshot().games[0], coverDataUrl:'data:image/png;base64,AAAA', coverUrl:'https://store-images.s-microsoft.com/box', heroUrl:'https://store-images.s-microsoft.com/hero' };
  expect(renderToStaticMarkup(<Cover game={game} />)).toContain('src="https://store-images.s-microsoft.com/box"');
  expect(renderToStaticMarkup(<Cover game={game} variant="hero" />)).toContain('src="https://store-images.s-microsoft.com/hero"');
  expect(renderToStaticMarkup(<Cover game={{...game, coverUrl:undefined, heroUrl:undefined}} />)).toContain('cover-local');
});

it('uses wide Store art for the Home banner and never stretches a small package logo',()=>{
  const data=demoSnapshot();
  data.games=[{...data.games[0],coverDataUrl:'data:image/png;base64,SMALLLOGO',coverUrl:'https://store-images.s-microsoft.com/box',heroUrl:'https://store-images.s-microsoft.com/hero'}];
  const banner=()=>{const html=renderToStaticMarkup(<HomePage data={data} go={()=>{}} action={()=>{}} />);return html.slice(html.indexOf('<section class="spotlight'),html.indexOf('<div class="spotlight-copy"'));};
  expect(banner()).toContain('url(https://store-images.s-microsoft.com/hero)');
  expect(banner()).not.toContain('SMALLLOGO');
  data.games[0].heroUrl=undefined;
  expect(banner()).toContain('url(https://store-images.s-microsoft.com/box)');
  data.games[0].coverUrl=undefined;
  expect(banner()).not.toContain('--spotlight-art');
});

it('gives installed cards a separate status footer and an accessible compact refresh control',()=>{
  const html=renderToStaticMarkup(<AccountGames data={demoSnapshot()} toast={()=>{}} />);
  expect(html).toContain('class="catalog-card-status"');
  expect(html).toContain('aria-label="Refresh library"');
  expect(html).toContain('class="account-games-results"');
  expect(html).not.toContain('class="library-license"');
});

it('keeps pagination loading inside the button, without the oversized Store loading panel',()=>{
  const more=renderToStaticMarkup(<LibraryPagination loading={true} hasMore={true} load={()=>{}} />);
  expect(more).toContain('disabled'); expect(more).toContain('Loading games');
  expect(more).not.toContain('catalog-loading'); expect(more).not.toContain('library-loading');
  const initial=renderToStaticMarkup(<LibraryPagination loading={true} hasMore={false} load={()=>{}} />);
  expect(initial).toContain('role="status"'); expect(initial).not.toContain('catalog-loading');
  expect(renderToStaticMarkup(<LibraryPagination loading={false} hasMore={false} load={()=>{}} />)).toBe('');
});

it('offers saved per-game overlay options and Steam-style environment and arguments',()=>{
  const html=renderToStaticMarkup(<GameLaunchToolFields value={{...defaultLaunchTools,mangoHud:true,gamescope:true,launchOptions:'PROTON_ENABLE_WAYLAND=1 %command% --launcher-skip'}} change={()=>{}} />);
  expect(html).toContain('Enable MangoHud'); expect(html).toContain('Run in gamescope');
  expect(html).toContain('Gamescope options'); expect(html).toContain('requires mangoapp');
  expect(html).toContain('Launch options'); expect(html).toContain('PROTON_ENABLE_WAYLAND=1 %command% --launcher-skip');
  expect(html).toContain('checked');
});
