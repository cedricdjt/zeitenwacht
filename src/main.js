// @ts-check
// Einstieg: baut die Anwendung zusammen und startet sie.

import { poolContent as content } from './content/index.js';
import { createGame } from './game/game.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('scene'));
const uiRoot = /** @type {HTMLElement} */ (document.getElementById('ui'));

const game = createGame({ canvas, uiRoot, content });
Object.assign(window, { __game: game.debug });
game.start();
