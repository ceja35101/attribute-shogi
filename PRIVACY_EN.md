# Privacy

Elemental Shogi Ver0.1 does not send personal information or game records to a game server in CPU or same-device matches. When you choose invite-only online play, the data required to synchronize the match is sent to Supabase.

The following data is stored in your browser:

- CPU difficulty
- Display language
- Sound and volume settings
- Tutorial completion state
- Board position, pieces in hand, elements, promotions, King durability, and clash state
- Turn, move log, complete game record, and replay snapshots
- A backup of saved data that could not be restored

You can remove this data by clearing the site's browser data. The in-game Reset button removes the current saved match.

Online play sends an anonymous user ID, invite code, board position, pieces in hand, elements, turn, clash state, move record, result, and update time to Supabase. No email address or player name is requested. A room expires 24 hours after its latest move; expired data is removed during later room creation. There are no analytics, advertisements, or automatic telemetry.

The feedback-template button only copies text to the clipboard. Data leaves the game for feedback only when you deliberately open the external GitHub page and submit it yourself.
