import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoSnapshot } from '../shared/demo-data';
import { LibraryPage, Sidebar } from './App';

it('only the three main sidebar pages select automatically, not recents/settings/queue/account', () => {
  const html = renderToStaticMarkup(<Sidebar data={demoSnapshot()} page="home" go={() => {}} />);
  const auto = [...html.matchAll(/<button\b[^>]*data-gamepad-auto-select=""[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
  expect(auto).toHaveLength(3);
  for (const name of ['Home', 'My Library', 'Store']) expect(auto.some(button => button.includes(`<span>${name}</span>`))).toBe(true);
  for (const name of ['Settings', 'Most recent', 'queue-summary', 'account-summary']) expect(auto.some(button => button.includes(name))).toBe(false);
});

it('only installed card selectors auto-select in the library, never Play/update/content/folder/menu actions', () => {
  const data = demoSnapshot();
  const html = renderToStaticMarkup(<LibraryPage data={data} toast={() => {}} />);
  const auto = [...html.matchAll(/<button\b[^>]*data-gamepad-auto-select="[^"]*"[^>]*>/g)].map(match => match[0]);
  expect(auto).toHaveLength(data.games.length);
  for (const button of auto) expect(button).toContain('data-gamepad-detail-target=');
  expect(html).not.toMatch(/<button\b[^>]*data-gamepad-auto-select[^>]*data-gamepad-play/);
});
