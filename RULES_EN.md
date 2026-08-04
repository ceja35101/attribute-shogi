# Elemental Shogi Rules — Ver. 0.1

Elemental Shogi keeps the standard 9×9 Shogi board, movement, promotion, captured-piece drops, and victory by defeating the opposing King. Every piece also receives one random element.

## Element Cycle

- Fire beats Wind
- Wind beats Water
- Water beats Fire

The 40 starting pieces are distributed as evenly as possible among the three elements. Both Kings receive the same randomly selected element.

## Battles

### Element advantage

The attacker captures the defender and moves onto the target square, as in standard Shogi.

### Element disadvantage

The attacker and defender both leave the board. The defending player captures the attacking piece; the defending piece is not captured.

### Same element

Both pieces enter a clash on the target square. The square is blocked. A normal clash expires after six turns and both pieces disappear.

Only a piece whose element beats the clashing element can reinforce. It must have already been on the board before the clash and enter one of the marked reinforcement squares. A piece already occupying that square when the clash began cannot reinforce that clash, even if it leaves and returns; replacing it with a different eligible piece works.

If an opposing strong piece of the same element blocks a reinforcement square and the intended reinforcement moves onto it, a linked clash begins. The original reinforcement does not resolve yet. Only one linked clash may be created for each original clash; both deadlines are reset once to six turns. A side that wins the linked clash with a strong reinforcement also wins the original clash. If the linked clash expires with both pieces disappearing, the original clash expires normally. Linked clashes cannot create further linked clashes.

The board marks the reset original clash as `O#↻` and its linked clash as `L#→#`.

## King and Durability

The King has 4 durability.

- An advantageous attack captures the King and wins immediately.
- A disadvantageous attack causes a short clash. After the King's side completes its turn, King durability decreases by 1 and the attacker enters the King's hand.
- A same-element attack causes a King clash. If it expires naturally, King durability decreases by 2 and the attacker disappears.
- A strong-element reinforcement by the King's side rescues the King and captures the attacker.
- A strong-element reinforcement by the attacking side defeats the King immediately.
- At 0 durability, the King loses.

Two Kings of the same element may clash. A strong reinforcement wins immediately; otherwise, the attacking King wins when the four-turn limit expires.

## Standard Shogi Rules

All eight piece types use their standard Shogi movement and promotion:

| Code | Piece |
|---|---|
| K | King |
| R | Rook |
| B | Bishop |
| G | Gold General |
| S | Silver General |
| N | Knight |
| L | Lance |
| P | Pawn |

Captured pieces return unpromoted and can be dropped on a legal empty square. Nifu, dead-end drops, pawn-drop mate, check, self-check, repetition, and perpetual-check rules are enforced.

## Current Beta Scope

- Single player versus a rule-based CPU
- Two-player matches on the same device
- Three difficulty levels
- Save, undo, game-record replay and export
- Keyboard, mouse and touch controls
- Japanese and English display

Online multiplayer is not included in this beta.
