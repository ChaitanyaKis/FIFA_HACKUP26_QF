# Overview

The **League Standings Leaderboard & Live Performance Analytics Portal** is a
broadcast-style React + TypeScript app that turns a scripted 4-team league season
(all teams, players and results fictional) into live performance analytics. Its
defining design choice is a strict single-source-of-truth architecture: the only
mutable state is one integer (`playedMatchdays`), and the entire UI — league
table, match stats, Man of the Match, W/D/L form and the title race — is
recomputed on every render by pure functions from the match-log, so the table and
the numbers can never desync. Pressing **Simulate Final Whistle** advances a
matchday and drives the show: rows physically slide to their new positions (FLIP),
the leader flashes gold, possession/shots/xG bars and an xG-swing momentum meter
animate, and a TV-style Man-of-the-Match lower-third slides in — scripted so the
underdog Kestrel City climbs from 4th to 1st and clinches the title on the final
day. The creative centrepiece is a live **AI Performance Analyst** that reads each
matchday's data and writes a short, data-driven tactical read via a direct
client-side Gemini (`gemini-3.5-flash`) call, with the API key kept in memory only
and a deterministic, data-grounded fallback that keeps the feature working with no
key, a rate limit, or no network.
