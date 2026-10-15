import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountGames, GameTitle, Sidebar } from './App';
import { demoSnapshot } from '../shared/demo-data';

it('keeps one My Library and Store navigation, no separate Game Pass page',()=>{
  const html=renderToStaticMarkup(<Sidebar data={demoSnapshot()} page="library" go={()=>{}} />);
  expect(html).toContain('My Library'); expect(html).toContain('Store');
  expect(html).not.toContain('<span>Game Pass</span>');
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
